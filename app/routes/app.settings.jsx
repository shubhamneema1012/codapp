import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";

const defaultSettings = {
  default_template: {
    headingText: "Verify Mobile Number",
    backgroundColor: "#fefefe",
    textColor: "#555555",
    buttonColor: "#000000",
    buttonTextColor: "#ffffff",
    // Button Texts
    codButtonText: "Cash on Delivery (COD)",
    prepaidButtonText: "Prepaid / Online Payment",
    sendOtpButtonText: "Send OTP",
    verifyButtonText: "Verify & Checkout",
    changeNumberText: "Change Mobile Number",
    // Error Messages
    phoneErrorText: "Please enter a valid mobile number.",
    otpErrorText: "The OTP you entered is incorrect.",
    // Payment Customization
    enableCodCustomization: false
  }
};

export default function SettingsPage() {
  const shopify = useAppBridge();
  const [formData, setFormData] = useState(defaultSettings);
  const [initialData, setInitialData] = useState(defaultSettings);
  const [shopId, setShopId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("shopify:admin/api/graphql.json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query {
                shop {
                  id
                  metafield(namespace: "codapp", key: "widget_settings") {
                    value
                  }
                }
              }
            `
          }),
        });

        const result = await response.json();

        if (result.data?.shop?.id) {
          setShopId(result.data.shop.id);

          if (result.data.shop.metafield?.value) {
            try {
              let parsedValue = JSON.parse(result.data.shop.metafield.value);

              // Graceful Migration: If old flat structure, wrap it under default_template
              if (!parsedValue.default_template) {
                parsedValue = { default_template: parsedValue };
              }

              const mergedData = {
                default_template: {
                  ...defaultSettings.default_template,
                  ...parsedValue.default_template
                }
              };
              setFormData(mergedData);
              setInitialData(mergedData);
            } catch (e) {
              console.error("Error parsing metafield JSON", e);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching shop data:", error);
      }
    };

    fetchData();
  }, []);

  const handleChange = (field, value) => {
    const newData = {
      ...formData,
      default_template: {
        ...formData.default_template,
        [field]: value
      }
    };
    setFormData(newData);

    if (JSON.stringify(newData) !== JSON.stringify(initialData)) {
      shopify.saveBar.show("settings-save-bar");
    } else {
      shopify.saveBar.hide("settings-save-bar");
    }
  };

  const syncPaymentCustomization = async (enable) => {
    try {
      // 1. Get deployed shopifyFunctions to find functionId
      const functionResponse = await fetch("shopify:admin/api/graphql.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query {
              shopifyFunctions(first: 50) {
                nodes {
                  id
                  title
                  apiType
                }
              }
            }
          `
        })
      });
      const functionResult = await functionResponse.json();
      const functions = functionResult.data?.shopifyFunctions?.nodes || [];

      const ourFunction = functions.find(fn =>
        fn.apiType === "payment_customization" &&
        (fn.title.toLowerCase().includes("payment-customization") || fn.title.toLowerCase().includes("payment customization"))
      );

      if (!ourFunction) {
        console.warn("Codapp payment-customization function not found in deployed shopifyFunctions list.");
        return;
      }

      const functionId = ourFunction.id;

      // 2. Get active payment customizations
      const customizationResponse = await fetch("shopify:admin/api/graphql.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query {
              paymentCustomizations(first: 50) {
                nodes {
                  id
                  title
                  enabled
                }
              }
            }
          `
        })
      });
      const customizationResult = await customizationResponse.json();
      const customizations = customizationResult.data?.paymentCustomizations?.nodes || [];

      // Find our rule by title
      const ourCustomization = customizations.find(cust =>
        cust.title === "COD Mobile Verification (Codapp)"
      );

      if (enable) {
        if (!ourCustomization) {
          // If enabling and doesn't exist, create it
          const createResponse = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `
                mutation paymentCustomizationCreate($input: PaymentCustomizationInput!) {
                  paymentCustomizationCreate(paymentCustomization: $input) {
                    paymentCustomization {
                      id
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `,
              variables: {
                input: {
                  title: "COD Mobile Verification (Codapp)",
                  enabled: true,
                  functionId: functionId
                }
              }
            })
          });
          const createResult = await createResponse.json();
          if (createResult.data?.paymentCustomizationCreate?.userErrors?.length > 0) {
            console.error("Error creating payment customization:", createResult.data.paymentCustomizationCreate.userErrors);
          } else {
            console.log("Payment customization rule activated successfully!");
          }
        } else if (!ourCustomization.enabled) {
          // If exists but disabled, enable it
          await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `
                mutation paymentCustomizationUpdate($id: ID!, $input: PaymentCustomizationInput!) {
                  paymentCustomizationUpdate(id: $id, paymentCustomization: $input) {
                    paymentCustomization {
                      id
                    }
                    userErrors {
                      message
                    }
                  }
                }
              `,
              variables: {
                id: ourCustomization.id,
                input: {
                  title: "COD Mobile Verification (Codapp)",
                  enabled: true,
                  functionId: functionId
                }
              }
            })
          });
        }
      } else {
        // If disabling and rule exists, delete it
        if (ourCustomization) {
          const deleteResponse = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `
                mutation paymentCustomizationDelete($id: ID!) {
                  paymentCustomizationDelete(id: $id) {
                    deletedId
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `,
              variables: {
                id: ourCustomization.id
              }
            })
          });
          const deleteResult = await deleteResponse.json();
          if (deleteResult.data?.paymentCustomizationDelete?.userErrors?.length > 0) {
            console.error("Error deleting payment customization:", deleteResult.data.paymentCustomizationDelete.userErrors);
          } else {
            console.log("Payment customization rule removed successfully!");
          }
        }
      }
    } catch (e) {
      console.error("Error synchronizing payment customization:", e);
    }
  };

  const handleSave = async () => {
    if (!shopId) {
      shopify.toast.show("Shop ID not found!");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Save Metafield configuration
      const response = await fetch("shopify:admin/api/graphql.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields {
                  id
                  value
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            metafields: [
              {
                ownerId: shopId,
                namespace: "codapp",
                key: "widget_settings",
                type: "json",
                value: JSON.stringify(formData)
              }
            ]
          }
        }),
      });

      const result = await response.json();

      if (result.data?.metafieldsSet?.userErrors?.length > 0) {
        console.error("Save errors:", result.data.metafieldsSet.userErrors);
        shopify.toast.show("Failed to save settings");
        setIsSaving(false);
        return;
      }

      // 2. Synchronize Shopify Payment Customization
      const isEnabled = formData.default_template.enableCodCustomization;
      await syncPaymentCustomization(isEnabled);

      shopify.toast.show("Settings saved successfully!");
      setInitialData(formData);
      shopify.saveBar.hide("settings-save-bar");
    } catch (error) {
      console.error("Error saving metafield:", error);
      shopify.toast.show("Error saving data");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setFormData(initialData);
    shopify.saveBar.hide("settings-save-bar");
  };

  const tSettings = formData.default_template;

  return (
    <s-page heading="Widget Settings">
      <ui-save-bar id="settings-save-bar">
        <button loading={isSaving ? "" : null} variant="primary" id="save-button" onClick={handleSave} disabled={isSaving}>Save</button>
        <button id="discard-button" onClick={handleDiscard}>Discard</button>
      </ui-save-bar>

      <s-grid gap="base" gridTemplateColumns="1fr 1fr">
        <s-section heading="Widget Customization">
          <div style={{ padding: "16px", backgroundColor: "#f4f6f8", border: "1px solid #c9cccf", borderRadius: "8px", marginBottom: "20px" }}>

            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid #c9cccf", paddingBottom: "6px" }}>1. Content & Text</h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Heading Text</label>
              <input
                type="text"
                value={tSettings.headingText}
                onChange={(e) => handleChange("headingText", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>COD Button Text</label>
              <input
                type="text"
                value={tSettings.codButtonText}
                onChange={(e) => handleChange("codButtonText", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Prepaid Button Text</label>
              <input
                type="text"
                value={tSettings.prepaidButtonText}
                onChange={(e) => handleChange("prepaidButtonText", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Send OTP Button Text</label>
              <input
                type="text"
                value={tSettings.sendOtpButtonText}
                onChange={(e) => handleChange("sendOtpButtonText", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Verify OTP Button Text</label>
              <input
                type="text"
                value={tSettings.verifyButtonText}
                onChange={(e) => handleChange("verifyButtonText", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Change Number Text</label>
              <input
                type="text"
                value={tSettings.changeNumberText}
                onChange={(e) => handleChange("changeNumberText", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "600", marginTop: "24px", marginBottom: "12px", borderBottom: "1px solid #c9cccf", paddingBottom: "6px" }}>2. Error Messages</h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Invalid Phone Error</label>
              <input
                type="text"
                value={tSettings.phoneErrorText}
                onChange={(e) => handleChange("phoneErrorText", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Incorrect OTP Error</label>
              <input
                type="text"
                value={tSettings.otpErrorText}
                onChange={(e) => handleChange("otpErrorText", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "600", marginTop: "24px", marginBottom: "12px", borderBottom: "1px solid #c9cccf", paddingBottom: "6px" }}>3. Styles & Colors</h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Background Color</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="color"
                  value={tSettings.backgroundColor}
                  onChange={(e) => handleChange("backgroundColor", e.target.value)}
                  style={{ width: "40px", height: "40px", padding: "0", border: "1px solid #c9cccf", borderRadius: "4px", cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={tSettings.backgroundColor}
                  onChange={(e) => handleChange("backgroundColor", e.target.value)}
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px", fontFamily: "monospace" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Text Color</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="color"
                  value={tSettings.textColor}
                  onChange={(e) => handleChange("textColor", e.target.value)}
                  style={{ width: "40px", height: "40px", padding: "0", border: "1px solid #c9cccf", borderRadius: "4px", cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={tSettings.textColor}
                  onChange={(e) => handleChange("textColor", e.target.value)}
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px", fontFamily: "monospace" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Button Color</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="color"
                  value={tSettings.buttonColor}
                  onChange={(e) => handleChange("buttonColor", e.target.value)}
                  style={{ width: "40px", height: "40px", padding: "0", border: "1px solid #c9cccf", borderRadius: "4px", cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={tSettings.buttonColor}
                  onChange={(e) => handleChange("buttonColor", e.target.value)}
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px", fontFamily: "monospace" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", color: "#202223" }}>Button Text Color</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="color"
                  value={tSettings.buttonTextColor}
                  onChange={(e) => handleChange("buttonTextColor", e.target.value)}
                  style={{ width: "40px", height: "40px", padding: "0", border: "1px solid #c9cccf", borderRadius: "4px", cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={tSettings.buttonTextColor}
                  onChange={(e) => handleChange("buttonTextColor", e.target.value)}
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px", fontFamily: "monospace" }}
                />
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "600", marginTop: "24px", marginBottom: "12px", borderBottom: "1px solid #c9cccf", paddingBottom: "6px" }}>4. Checkout Rules</h3>

            <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                id="enableCodCustomization"
                checked={tSettings.enableCodCustomization || false}
                onChange={(e) => handleChange("enableCodCustomization", e.target.checked)}
                style={{ width: "20px", height: "20px", cursor: "pointer" }}
              />
              <label htmlFor="enableCodCustomization" style={{ fontWeight: "600", color: "#202223", cursor: "pointer" }}>
                Hide COD payment method until verified via OTP
              </label>
            </div>

          </div>
        </s-section>

        <s-section heading="Preview">
          <div style={{
            backgroundColor: tSettings.backgroundColor,
            padding: "24px",
            border: "1px solid #888",
            width: "100%",
            maxWidth: "400px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontFamily: "sans-serif",
            margin: "0 auto",
            color: tSettings.textColor
          }}>
            <h2 style={{ marginTop: "0", marginBottom: "8px", fontSize: "20px", fontWeight: "600", color: tSettings.textColor }}>
              {tSettings.headingText}
            </h2>

            <p style={{ fontSize: "15px", color: tSettings.textColor, marginBottom: "16px", textAlign: "center" }}>
              How would you like to pay for your order?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
              <button style={{
                padding: "12px",
                backgroundColor: tSettings.buttonColor,
                color: tSettings.buttonTextColor,
                border: "none",
                borderRadius: "4px",
                fontSize: "16px",
                cursor: "pointer",
                width: "100%",
                fontWeight: "500"
              }}>
                {tSettings.codButtonText}
              </button>
              <button style={{
                padding: "12px",
                backgroundColor: "transparent",
                color: tSettings.textColor,
                border: `1px solid ${tSettings.buttonColor}`,
                borderRadius: "4px",
                fontSize: "16px",
                cursor: "pointer",
                width: "100%",
                fontWeight: "500"
              }}>
                {tSettings.prepaidButtonText}
              </button>
            </div>

            <div style={{ borderTop: "1px solid #ddd", paddingTop: "12px", marginTop: "12px" }}>
              <p style={{ fontSize: "12px", color: "#e74c3c", margin: "0 0 8px 0" }}>
                ⚠️ Error preview: {tSettings.phoneErrorText}
              </p>
            </div>
          </div>
        </s-section>
      </s-grid>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
