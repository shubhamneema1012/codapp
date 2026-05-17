import { useState, useEffect } from "react";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
    query {
      shop {
        metafield(namespace: "codapp", key: "cos_analytics") {
          value
        }
      }
    }`
  );
  
  const responseJson = await response.json();
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

  return Response.json(analyticsData);
};

export default function Index() {
  const analytics = useLoaderData();
  // Safe way to access global shopify in Remix/React Router without SSR crashes!
  const shopify = useAppBridge();
  const [shop, setShop] = useState("");
  const [embedActive, setEmbedActive] = useState(false);
  const clientId = "45812786a8f255567995f78c02ca34fa";

  useEffect(() => {
    // We can use shopify here directly now!
    if (shopify && shopify.config && shopify.config.shop) {
      setShop(shopify.config.shop);
    }

    async function checkExtensionStatus() {
      if (shopify && shopify.app) {
        try {
          const extensionsData = await shopify.app.extensions();
          let isActive = false;

          if (Array.isArray(extensionsData)) {
            for (const ext of extensionsData) {
              if (ext.activations && Array.isArray(ext.activations)) {
                for (const activation of ext.activations) {
                  if (activation.handle === 'checkout_popup' && activation.status === 'active') {
                    isActive = true;
                  }
                }
              }
            }
          }
          setEmbedActive(isActive);
        } catch (err) {
          console.error("Failed to fetch extensions status:", err);
        }
      }
    }

    checkExtensionStatus();
  }, [shopify]);

  const deepLink = shop
    ? `https://admin.shopify.com/store/${shop.replace('.myshopify.com', '')}/themes/current/editor?context=apps&activateAppId=${clientId}/checkout_popup`
    : "#";

  return (
    <s-page heading="COD Verify Setup">
      {embedActive ? (
        <s-banner heading="COD Verification is Active 🎉" tone="success">
          <p style={{ margin: "0 0 8px 0" }}>
            Great job! Your store is now protected. The OTP verification popup will appear at checkout for Cash on Delivery orders.
          </p>
          <s-button
            slot="secondary-actions"
            variant="secondary"
            onClick={() => window.open(deepLink, '_blank')}
          >
            Manage in Theme Editor
          </s-button>
        </s-banner>
      ) : (
        <s-banner heading="Action Required: Enable App Embed" tone="warning">
          <p style={{ margin: "0 0 8px 0" }}>
            The COD Verify app is currently <strong>disabled</strong> on your storefront.
            To start verifying mobile numbers, you must enable the app embed in your theme settings.
          </p>
          <s-button
            slot="secondary-actions"
            variant="primary"
            onClick={() => window.open(deepLink, '_blank')}
          >
            Enable App Embed
          </s-button>
        </s-banner>
      )}
      
      <s-grid gap="base" gridTemplateColumns="1fr 1fr 1fr 1fr" style={{ marginTop: "24px" }}>
        <s-section heading="Total Popup Views">
          <span style={{ fontSize: "24px", fontWeight: "bold" }}>{analytics.total_orders}</span>
        </s-section>
        <s-section heading="Verified COD">
          <span style={{ fontSize: "24px", fontWeight: "bold", color: "#007f5f" }}>{analytics.verified_orders}</span>
        </s-section>
        <s-section heading="Prepaid Selected">
          <span style={{ fontSize: "24px", fontWeight: "bold" }}>{analytics.prepaid_orders}</span>
        </s-section>
        <s-section heading="Unverified / Dropped">
          <span style={{ fontSize: "24px", fontWeight: "bold", color: "#d9534f" }}>{analytics.unverified_orders}</span>
        </s-section>
      </s-grid>

    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
