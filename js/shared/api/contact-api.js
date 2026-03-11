import { CONTACT_SERVICE_CONFIG } from "./endpoints.js";

let isInitialized = false;

function getEmailClient() {
  return typeof window.emailjs === "undefined" ? null : window.emailjs;
}

export function initializeContactApi() {
  const emailClient = getEmailClient();
  if (!emailClient) return false;

  if (!isInitialized) {
    emailClient.init(CONTACT_SERVICE_CONFIG.publicKey);
    isInitialized = true;
  }

  return true;
}

export async function sendContactMessage(payload) {
  const emailClient = getEmailClient();
  if (!emailClient) {
    return {
      ok: false,
      data: null,
      error: "EmailJS is not loaded. Please check your internet connection.",
    };
  }

  initializeContactApi();

  try {
    const data = await emailClient.send(
      CONTACT_SERVICE_CONFIG.serviceId,
      CONTACT_SERVICE_CONFIG.templateId,
      payload
    );

    return {
      ok: true,
      data,
      error: "",
    };
  } catch (error) {
    console.error("EmailJS Error:", error);
    return {
      ok: false,
      data: null,
      error: "Failed to send the message. Please try again later.",
    };
  }
}
