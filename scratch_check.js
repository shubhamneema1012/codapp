import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.session.findMany();
  console.log("Sessions found:", sessions.length);
  for (const session of sessions) {
    console.log("Shop:", session.shop);
    console.log("Access Token:", session.accessToken);
    console.log("Scopes:", session.scope);
    
    try {
      const response = await axios({
        url: `https://${session.shop}/admin/api/2026-04/graphql.json`,
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json'
        },
        data: {
          query: `
            query {
              shopifyFunctions(first: 50) {
                nodes {
                  id
                  title
                  apiType
                }
              }
              paymentCustomizations(first: 50) {
                nodes {
                  id
                  title
                  enabled
                }
              }
            }
          `
        }
      });
      console.log("GraphQL Result for", session.shop);
      console.log("Functions:", JSON.stringify(response.data.data.shopifyFunctions.nodes, null, 2));
      console.log("Customizations:", JSON.stringify(response.data.data.paymentCustomizations.nodes, null, 2));
    } catch (e) {
      console.error("Error for", session.shop, e.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
