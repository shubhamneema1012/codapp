import { useState, useEffect } from "react";

// Upar ek default JSON object banaya gaya hai. 
// In future aap isme aur nayi keys (jaise settings, API keys etc.) add kar sakte hain.
const defaultData = {
  inputValue: "",
  // newKey1: "defaultValue",
  // newKey2: 123
};

export default function AdditionalPage() {
  const [formData, setFormData] = useState(defaultData);
  const [initialData, setInitialData] = useState(defaultData);
  const [shopId, setShopId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Jab component load hoga, hum Shop ki ID aur purani metafield ki value nikalenge
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
                  metafield(namespace: "custom", key: "shubhtest") {
                    value
                  }
                }
              }
            `
          }),
        });

        const result = await response.json();

        // Agar shop ID mil gayi toh save kar lenge
        if (result.data?.shop?.id) {
          setShopId(result.data.shop.id);

          // Agar metafield pehle se available hai, toh uska data parse karke input mein dikhayenge
          if (result.data.shop.metafield?.value) {
            try {
              const parsedValue = JSON.parse(result.data.shop.metafield.value);
              // Default data aur saved data ko merge karenge, taaki koi nayi key miss na ho
              const mergedData = { ...defaultData, ...parsedValue };
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

  // Jab user input me kuch type karega
  const handleChange = (e) => {
    const newData = { ...formData, inputValue: e.target.value };
    setFormData(newData);

    // Agar naya data initialData (purana saved ya default) se alag hai toh save bar show karein
    if (JSON.stringify(newData) !== JSON.stringify(initialData)) {
      shopify.saveBar.show("my-save-bar");
    } else {
      // Agar data match kar gaya (koi naya change nahi hai), toh save bar hide kar dein
      shopify.saveBar.hide("my-save-bar");
    }
  };

  // Jab user Save bar mein Save button pe click karega
  const handleSave = async () => {
    if (!shopId) {
      shopify.toast.show("Shop ID not found!");
      return;
    }

    setIsSaving(true);
    try {
      // GraphQL Mutation to save shop metafield
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
                namespace: "custom",
                key: "shubhtest",
                type: "single_line_text_field", // Store pe already single_line_text_field defined hai, isliye isko match karna padega
                value: JSON.stringify(formData) // Data ko stringify karke bhejenge
              }
            ]
          }
        }),
      });

      const result = await response.json();

      if (result.data?.metafieldsSet?.userErrors?.length > 0) {
        console.error("Save errors:", result.data.metafieldsSet.userErrors);
        shopify.toast.show("Failed to save metafield");
      } else {
        shopify.toast.show("Saved successfully!");
        setInitialData(formData);

        // Save hone ke baad save bar ko hide kar denge
        shopify.saveBar.hide("my-save-bar");
      }
    } catch (error) {
      console.error("Error saving metafield:", error);
      shopify.toast.show("Error saving data");
    } finally {
      setIsSaving(false);
    }
  };

  // Jab user Discard button pe click karega
  const handleDiscard = () => {
    // Data ko wapas uski purani state par le jayenge aur save bar hide karenge
    setFormData(initialData);
    shopify.saveBar.hide("my-save-bar");
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      {/* App Bridge V4 ui-save-bar */}
      <ui-save-bar id="my-save-bar">
        <button loading={isSaving ? "" : null} variant="primary" id="save-button" onClick={handleSave} disabled={isSaving}>Save</button>
        <button id="discard-button" onClick={handleDiscard}>Discard</button>
      </ui-save-bar>

      <h2>Configuration Settings</h2>

      <div style={{ marginTop: "20px", padding: "16px", background: "#f4f6f8", borderRadius: "8px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>App Data Input:</label>
        <input
          type="text"
          value={formData.inputValue}
          onChange={handleChange}
          style={{
            width: "100%",
            padding: "10px",
            maxWidth: "400px",
            border: "1px solid #c9cccf",
            borderRadius: "4px"
          }}
          placeholder="Enter some test data..."
        />
        <p style={{ marginTop: "10px", fontSize: "14px", color: "#6d7175" }}>
          Ye data shop ki metafield <code>custom.shubhtest</code> mein as a JSON object save hoga.
        </p>
      </div>
    </div>
  );
}