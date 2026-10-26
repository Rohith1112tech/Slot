/**
 * Google Apps Script Webhook Service
 * Handles GET (fetch current slots) and POST (auto-save slot changes)
 */

export const DEFAULT_WEBHOOK_URL = 
  import.meta.env.VITE_WEBHOOK_URL || 
  localStorage.getItem('nexus_gas_webhook_url') || 
  'https://script.google.com/macros/s/AKfycbyXcvmlPKv_L9uVCSasDdKlOTGqSrKtm4nv-ZOHVAo4ZMJenRdXUYTvMPrRWAr5aGxAfQ/exec';

/**
 * Fetch all 12 slots from Google Apps Script Webhook via GET
 */
export async function fetchSlotsFromWebhook(webhookUrl) {
  if (!webhookUrl || !webhookUrl.trim()) {
    throw new Error('No Webhook URL configured');
  }

  const response = await fetch(webhookUrl.trim(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  const data = await response.json();
  
  // Format normalization: backend can return { slots: [...] } or array directly
  const rawSlots = Array.isArray(data) ? data : data.slots;
  if (!Array.isArray(rawSlots)) {
    throw new Error('Invalid data format received from webhook');
  }

  return rawSlots.map((item, idx) => ({
    slotNumber: Number(item.slotNumber || idx + 1),
    teamName: String(item.teamName || ''),
    iglName: String(item.iglName || ''),
    isBooked: Boolean(item.isBooked),
  }));
}

/**
 * Auto-Save slot mutation via POST to Google Apps Script Webhook
 * @param {string} webhookUrl - The Webhook URL
 * @param {object} payload - { slotNumber, teamName, iglName, actionType }
 */
export async function postSlotUpdateToWebhook(webhookUrl, payload) {
  if (!webhookUrl || !webhookUrl.trim()) {
    console.warn('[Webhook] No URL configured. Slot updated locally.');
    return { success: true, localOnly: true };
  }

  const bodyData = {
    slotNumber: payload.slotNumber,
    teamName: payload.teamName || '',
    iglName: payload.iglName || '',
    actionType: payload.actionType, // 'CLAIM' | 'EDIT' | 'CLEAR' | 'MANUAL_ASSIGN' | 'RESET_ALL'
    timestamp: new Date().toISOString(),
  };

  /**
   * Note for Google Apps Script Web Apps:
   * Using 'text/plain;charset=utf-8' prevents CORS preflight OPTIONS failures
   * while allowing GAS doPost(e) to read e.postData.contents seamlessly.
   */
  const response = await fetch(webhookUrl.trim(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(bodyData),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Webhook POST failed with status ${response.status}`);
  }

  try {
    const json = await response.json();
    return json;
  } catch {
    return { success: true };
  }
}
