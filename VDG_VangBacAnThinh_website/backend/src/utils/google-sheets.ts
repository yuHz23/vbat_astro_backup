import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SHEET_CUSTOMERS = 'Khách hàng';
const SHEET_ORDERS = 'Đơn hàng';

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  if (!credentials.client_email) return null;

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheets() {
  const auth = getAuth();
  if (!auth) return null;
  return google.sheets({ version: 'v4', auth });
}

// Initialize sheet headers if empty
export async function initSheetHeaders() {
  const sheets = getSheets();
  if (!sheets || !SPREADSHEET_ID) return;

  try {
    // Check if Khách hàng sheet has headers
    const customerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_CUSTOMERS}'!A1:G1`,
    });
    if (!customerRes.data.values || customerRes.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_CUSTOMERS}'!A1:G1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Họ tên', 'SĐT', 'Email', 'Ngày đăng ký', 'Mã đơn hàng', 'Tổng đơn', 'Tổng chi tiêu (VND)']],
        },
      });
    }

    // Check if Đơn hàng sheet has headers
    const orderRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_ORDERS}'!A1:I1`,
    });
    if (!orderRes.data.values || orderRes.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_ORDERS}'!A1:I1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Mã đơn hàng', 'Tên KH', 'SĐT', 'Email', 'Sản phẩm', 'Số lượng', 'Tổng tiền (VND)', 'Trạng thái', 'Ngày đặt']],
        },
      });
    }
  } catch (err) {
    console.error('[google-sheets] Failed to init headers:', err);
  }
}

// Add new customer row when they register
export async function addCustomerRow(data: {
  fullName: string;
  phone: string;
  email: string;
  registeredAt: string;
}) {
  const sheets = getSheets();
  if (!sheets || !SPREADSHEET_ID) return;

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_CUSTOMERS}'!A:G`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[data.fullName, data.phone, data.email, data.registeredAt, '', 0, 0]],
      },
    });
  } catch (err) {
    console.error('[google-sheets] Failed to add customer:', err);
  }
}

// Add order row and update customer's order list
export async function addOrderRow(data: {
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  email: string;
  items: string;
  totalQuantity: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}) {
  const sheets = getSheets();
  if (!sheets || !SPREADSHEET_ID) return;

  try {
    // 1. Append to Đơn hàng sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_ORDERS}'!A:I`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          data.orderNumber,
          data.contactName,
          data.contactPhone,
          data.email,
          data.items,
          data.totalQuantity,
          data.totalAmount,
          data.status,
          data.createdAt,
        ]],
      },
    });

    // 2. Update customer row: add order code only (no spending yet - order is pending)
    await updateCustomerOrderCode(data.contactPhone, data.orderNumber);
  } catch (err) {
    console.error('[google-sheets] Failed to add order:', err);
  }
}

// Find customer row by phone and helper
async function findCustomerRow(phone: string) {
  const sheets = getSheets();
  if (!sheets || !SPREADSHEET_ID) return null;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_CUSTOMERS}'!A:G`,
  });

  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    const rowPhone = (rows[i][1] || '').toString().trim();
    if (rowPhone === phone.trim()) {
      return { sheets, rowIndex: i, row: rows[i] };
    }
  }
  return null;
}

// Add order code to customer row (called when order is created, no spending yet)
async function updateCustomerOrderCode(phone: string, orderNumber: string) {
  try {
    const found = await findCustomerRow(phone);
    if (!found) return;

    const { sheets, rowIndex, row } = found;
    const existingOrders = row[4] ? row[4].toString() : '';
    const newOrders = existingOrders ? `${existingOrders}, ${orderNumber}` : orderNumber;
    const sheetRow = rowIndex + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_CUSTOMERS}'!E${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[newOrders]] },
    });
  } catch (err) {
    console.error('[google-sheets] Failed to update customer order code:', err);
  }
}

// Update customer spending + order count (called when order is confirmed/paid)
export async function updateCustomerSpending(phone: string, amount: number) {
  try {
    const found = await findCustomerRow(phone);
    if (!found) return;

    const { sheets, rowIndex, row } = found;
    const existingCount = parseInt(row[5]) || 0;
    const existingSpend = parseInt(row[6]) || 0;
    const sheetRow = rowIndex + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_CUSTOMERS}'!F${sheetRow}:G${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[existingCount + 1, existingSpend + amount]] },
    });
  } catch (err) {
    console.error('[google-sheets] Failed to update customer spending:', err);
  }
}

// Update order status in Đơn hàng sheet
export async function updateOrderStatus(orderNumber: string, newStatus: string) {
  const sheets = getSheets();
  if (!sheets || !SPREADSHEET_ID) return;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_ORDERS}'!A:I`,
    });

    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] || '').toString().trim() === orderNumber.trim()) {
        const sheetRow = i + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_ORDERS}'!H${sheetRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[newStatus]] },
        });
        break;
      }
    }
  } catch (err) {
    console.error('[google-sheets] Failed to update order status:', err);
  }
}
