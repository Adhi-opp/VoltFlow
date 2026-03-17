import { Resend } from "resend";
import { logger } from "@/lib/logger";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM || "WireMart <noreply@wiremart.in>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://wiremart.in";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    logger.info("Email skipped (no RESEND_API_KEY)", { to, subject });
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

// ── New RFQ → notify matching dealers ──────────────────────────────────────

export async function sendNewRfqNotification(
  dealerEmail: string,
  data: { dealerName: string; projectName: string; estimateValue: number; rfqCity: string }
) {
  await send(
    dealerEmail,
    `New Quote Request in ${data.rfqCity} — ${data.projectName}`,
    `<p>Hi ${esc(data.dealerName)},</p>
     <p>A new project "<strong>${esc(data.projectName)}</strong>" (est. value ${formatINR(data.estimateValue)}) is open for quotes in ${esc(data.rfqCity)}.</p>
     <p><a href="${APP_URL}/dealer/dashboard">View &amp; Submit Quote</a></p>
     <p>— WireMart</p>`
  );
}

// ── New quote submitted → notify homeowner ─────────────────────────────────

export async function sendQuoteReceivedNotification(
  homeownerEmail: string,
  data: { homeownerName: string; projectName: string; dealerCompany: string; quotePrice: number }
) {
  await send(
    homeownerEmail,
    `New quote received for ${data.projectName}`,
    `<p>Hi ${esc(data.homeownerName)},</p>
     <p><strong>${esc(data.dealerCompany)}</strong> submitted a quote of ${formatINR(data.quotePrice)} for your project "${esc(data.projectName)}".</p>
     <p><a href="${APP_URL}/dashboard">View Quotes</a></p>
     <p>— WireMart</p>`
  );
}

// ── Quote accepted → notify winning dealer with homeowner contact ──────────

export async function sendQuoteAcceptedNotification(
  dealerEmail: string,
  data: {
    dealerName: string;
    projectName: string;
    homeownerName: string;
    homeownerEmail: string;
    homeownerPhone: string | null;
  }
) {
  const phoneLine = data.homeownerPhone
    ? `<p>Phone: ${esc(data.homeownerPhone)}</p>`
    : "";
  await send(
    dealerEmail,
    `Your quote was accepted — ${data.projectName}`,
    `<p>Hi ${esc(data.dealerName)},</p>
     <p>Your quote for "<strong>${esc(data.projectName)}</strong>" has been accepted!</p>
     <h3>Homeowner Contact</h3>
     <p>Name: ${esc(data.homeownerName)}</p>
     <p>Email: ${esc(data.homeownerEmail)}</p>
     ${phoneLine}
     <p>Please reach out to the homeowner to finalize the order.</p>
     <p>— WireMart</p>`
  );
}

// ── Quote rejected → notify dealer ────────────────────────────────────────

export async function sendQuoteRejectedNotification(
  dealerEmail: string,
  data: { dealerName: string; projectName: string }
) {
  await send(
    dealerEmail,
    `Quote update — ${data.projectName}`,
    `<p>Hi ${esc(data.dealerName)},</p>
     <p>Your quote for "${esc(data.projectName)}" was not accepted this time.</p>
     <p><a href="${APP_URL}/dealer/dashboard">Browse more projects</a></p>
     <p>— WireMart</p>`
  );
}

// ── Dealer profile approved → notify dealer ──────────────────────────────

export async function sendDealerApprovedNotification(
  dealerEmail: string,
  data: { dealerName: string; companyName: string }
) {
  await send(
    dealerEmail,
    "Your WireMart dealer profile has been approved",
    `<p>Hi ${esc(data.dealerName)},</p>
     <p>Your dealer profile for <strong>${esc(data.companyName)}</strong> has been approved.</p>
     <p>You can now browse and quote on open projects in your service area.</p>
     <p><a href="${APP_URL}/dealer/dashboard">Go to Dealer Dashboard</a></p>
     <p>— WireMart</p>`
  );
}

// ── Dealer profile rejected → notify dealer ──────────────────────────────

export async function sendDealerRejectedNotification(
  dealerEmail: string,
  data: { dealerName: string; companyName: string }
) {
  await send(
    dealerEmail,
    "WireMart dealer profile update",
    `<p>Hi ${esc(data.dealerName)},</p>
     <p>Your dealer profile for <strong>${esc(data.companyName)}</strong> could not be approved at this time.</p>
     <p>Please ensure your GSTIN and dealership certificates are valid and try updating your profile.</p>
     <p><a href="${APP_URL}/dealer/profile/setup">Update Profile</a></p>
     <p>— WireMart</p>`
  );
}
