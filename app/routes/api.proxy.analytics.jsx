import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  // Ensure the request is coming via Shopify App Proxy
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (request.method === "POST") {
    try {
      const data = await request.json();
      const actionType = data.action; // 'verify', 'prepaid', 'unverified'

      // Fetch the current shop metafield 'cos_analytics'
      const response = await admin.graphql(
        `#graphql
        query {
          shop {
            id
            metafield(namespace: "codapp", key: "cos_analytics") {
              id
              value
            }
          }
        }`
      );

      const responseJson = await response.json();
      const shopId = responseJson.data.shop.id;
      const metafield = responseJson.data.shop.metafield;

      let analyticsData = {
        total_orders: 0,
        verified_orders: 0,
        prepaid_orders: 0,
        unverified_orders: 0
      };

      if (metafield && metafield.value) {
        try {
          analyticsData = JSON.parse(metafield.value);
        } catch (e) {
          console.error("Failed to parse analytics metafield", e);
        }
      }

      // Increment counts
      analyticsData.total_orders += 1;
      
      if (actionType === "verify") {
        analyticsData.verified_orders += 1;
      } else if (actionType === "prepaid") {
        analyticsData.prepaid_orders += 1;
      } else if (actionType === "unverified") {
        analyticsData.unverified_orders += 1;
      }

      // Update the metafield
      const updateResponse = await admin.graphql(
        `#graphql
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              key
              namespace
              value
              createdAt
              updatedAt
            }
            userErrors {
              field
              message
              code
            }
          }
        }`,
        {
          variables: {
            metafields: [
              {
                ownerId: shopId,
                namespace: "codapp",
                key: "cos_analytics",
                type: "json",
                value: JSON.stringify(analyticsData)
              }
            ]
          }
        }
      );

      const updateResponseJson = await updateResponse.json();
      
      if (updateResponseJson.data?.metafieldsSet?.userErrors?.length > 0) {
        console.error("Metafield update errors:", updateResponseJson.data.metafieldsSet.userErrors);
        return Response.json({ success: false, error: "Failed to update metafield" }, { status: 500 });
      }

      return Response.json({ success: true, analytics: analyticsData });
    } catch (error) {
      console.error("Error updating analytics:", error);
      return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }

  return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
};
