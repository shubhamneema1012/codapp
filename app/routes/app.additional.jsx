import { useEffect } from "react";

export default function AdditionalPage() {

  useEffect(() => {

    const fetchProducts = async () => {
      try {
        const response = await fetch(
          "shopify:admin/api/graphql.json",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: `
                query {
                  products(first: 10) {
                    edges {
                      node {
                        id
                        title
                      }
                    }
                  }
                }
              `,
            }),
          }
        );

        const result = await response.json();

        console.log("Products:", result.data);

      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };

    fetchProducts();

  }, []);

  return (
    <s-page heading="Additional page">
      <s-section heading="Multiple pages">
        <s-paragraph>
          The app template comes with an additional page which
          demonstrates how to create multiple pages within app
          navigation using{" "}
          <s-link
            href="https://shopify.dev/docs/apps/tools/app-bridge"
            target="_blank"
          >
            App Bridge
          </s-link>.
        </s-paragraph>

        <s-paragraph>
          To create your own page and have it show up in the
          app navigation, add a page inside{" "}
          <code>app/routes</code>, and a link to it in the{" "}
          <code>&lt;ui-nav-menu&gt;</code> component found in{" "}
          <code>app/routes/app.jsx</code>.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Resources">
        <s-unordered-list>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav"
              target="_blank"
            >
              App nav best practices
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}