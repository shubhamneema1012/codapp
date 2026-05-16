import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import shopify, { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const clientId = "45812786a8f255567995f78c02ca34fa";
  let isAppBlockActive = false;
  let debugError = null;

  try {
    // 1. Fetch main theme ID using GraphQL (Always works)
    const themesResponse = await admin.graphql(`
      query {
        themes(first: 1, roles: MAIN) {
          nodes {
            id
          }
        }
      }
    `);
    const themesData = await themesResponse.json();
    const mainThemeIdRaw = themesData.data?.themes?.nodes?.[0]?.id;

    if (mainThemeIdRaw) {
      const themeId = mainThemeIdRaw.split('/').pop();

      // 2. Fetch settings_data.json using a manual fetch to be safe from undefined admin.rest
      const apiVersion = "2024-07";
      const url = `https://${session.shop}/admin/api/${apiVersion}/themes/${themeId}/assets.json?asset[key]=config/settings_data.json`;

      const response = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": session.accessToken,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const assetData = await response.json();
        if (assetData.asset && assetData.asset.value) {
          const settingsData = JSON.parse(assetData.asset.value);
          const blocks = settingsData?.current?.blocks || {};

          for (const key in blocks) {
            const block = blocks[key];
            if (block.type && block.type.includes(clientId) && block.type.includes("checkout_popup")) {
              if (block.disabled === false || block.disabled === undefined) {
                isAppBlockActive = true;
                break;
              }
            }
          }
        }
      } else {
        const errorText = await response.text();
        debugError = `REST API Fetch failed: ${response.status} ${errorText}`;
      }
    }
  } catch (err) {
    console.error("Loader error:", err);
    debugError = err.message;
  }

  return {
    shop: session.shop,
    isAppBlockActive,
    clientId,
    error: debugError
  };
};

export default function Index() {
  const { shop, isAppBlockActive, clientId, error } = useLoaderData();

  const deepLink = `https://admin.shopify.com/store/${shop.replace('.myshopify.com', '')}/themes/current/editor?context=apps&activateAppId=${clientId}/checkout_popup`;
  console.log(shopify)
  return (
    <s-page heading="COD Verify Setup">
      {error && (
        <s-section heading="System Info">
          <div style={{ padding: "16px", backgroundColor: "#ffebee", border: "1px solid #ffcdd2", borderRadius: "8px", marginBottom: "20px" }}>
            <p style={{ color: "#c62828", margin: 0 }}><strong>Status Check Issue:</strong> {error}</p>
            <p style={{ color: "#c62828", margin: "8px 0 0 0", fontSize: "14px" }}>You can still use the button below to enable the app in your theme editor.</p>
          </div>
        </s-section>
      )}

      <s-section heading="App Embed Status">
        {isAppBlockActive ? (
          <div style={{ padding: "16px", backgroundColor: "#e3f1df", border: "1px solid #aee9d1", borderRadius: "8px", marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#114c2b", fontSize: "16px" }}>✅ App Embed is Active</h3>
            <p style={{ margin: 0, color: "#1f3b2b" }}>The COD verification popup is currently enabled in your theme. Customers will be required to verify their mobile numbers for COD orders.</p>
          </div>
        ) : (
          <div style={{ padding: "16px", backgroundColor: "#fff5ea", border: "1px solid #ffe1b3", borderRadius: "8px", marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#613b11", fontSize: "16px" }}>⚠️ App Embed is Disabled</h3>
            <p style={{ margin: "0 0 16px 0", color: "#4f311c" }}>You need to enable the COD Verify App Embed in your theme settings to start verifying mobile numbers.</p>
            <s-button variant="primary" onClick={() => window.open(deepLink, '_blank')}>
              Enable App Embed
            </s-button>
          </div>
        )}
      </s-section>

      <s-section heading="How it works">
        <s-paragraph>
          When enabled, the app embed intercepts the checkout process and displays a popup for the customer to verify their mobile number using OTP. Only verified customers can proceed to complete their Cash On Delivery orders.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
