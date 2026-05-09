
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  // Ensure the request is coming via Shopify App Proxy
  const { session } = await authenticate.public.appProxy(request);

  if (request.method === "POST") {
    try {
      const data = await request.json();
      const mobileNumber = data.mobile;

      // --------------------------------------------------------
      // AS REQUESTED: Console log the mobile number for now
      // --------------------------------------------------------
      console.log("\n==========================================");
      console.log("📲 RECEIVED MOBILE NUMBER FROM CHECKOUT POPUP:");
      console.log(mobileNumber);
      if (session && session.shop) {
         console.log("🏪 Shop:", session.shop);
      }
      console.log("==========================================\n");

      return Response.json({ success: true, message: "Mobile number received successfully" });
    } catch (error) {
      console.error("Error processing mobile number:", error);
      return Response.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }
  }

  return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
};
