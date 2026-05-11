import { authenticate } from "../shopify.server";
import axios from "axios";

export const action = async ({ request }) => {
  // Ensure the request is coming via Shopify App Proxy
  const { session } = await authenticate.public.appProxy(request);

  if (request.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await request.json();
    const { actionType, mobile, otp } = data;

    // Real auth key and template ID
    const authkey = "514481AtlXT2TFg69fef548P1";
    const template_id = "69fcb612b027d1a02800b6b5";

    console.log(`\n================= MSG91 OTP: ${actionType.toUpperCase()} =================`);
    console.log(`Mobile: ${mobile}`);
    if (otp) console.log(`OTP: ${otp}`);
    // Ensure mobile has no '+' as MSG91 expects e.g., 919876543210
    const cleanMobile = mobile ? mobile.replace(/^\+/, '') : '';

    if (actionType === "send") {
      const options = {
        method: 'POST',
        url: 'https://control.msg91.com/api/v5/otp',
        params: { template_id: template_id, mobile: cleanMobile },
        headers: {
          'Content-Type': 'application/json',
          'authkey': authkey
        },
        data: {} // Use empty object if no parameters are required by your template
      };

      const response = await axios.request(options);
      console.log("Response:", response.data);
      console.log("========================================================\n");
      
      if (response.data && response.data.type === "error") {
        return Response.json({ success: false, error: response.data.message }, { status: 400 });
      }
      return Response.json({ success: true, data: response.data });
      
    } else if (actionType === "verify") {
      const options = {
        method: 'GET',
        url: 'https://control.msg91.com/api/v5/otp/verify',
        params: { otp: otp, mobile: cleanMobile },
        headers: { authkey: authkey }
      };

      const response = await axios.request(options);
      console.log("Response:", response.data);
      console.log("========================================================\n");
      
      if (response.data && response.data.type === "error") {
        return Response.json({ success: false, error: response.data.message }, { status: 400 });
      }
      return Response.json({ success: true, data: response.data });

    } else {
      console.log("Invalid Action Type");
      return Response.json({ success: false, error: "Invalid actionType" }, { status: 400 });
    }

  } catch (error) {
    console.error("Error processing OTP:", error.response?.data || error.message);
    console.log("========================================================\n");
    const errorMessage = error.response?.data?.message || "Failed to process OTP. Please check credentials or inputs.";
    return Response.json({ success: false, error: errorMessage }, { status: 400 });
  }
};
