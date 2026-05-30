# Xero Accounting API Guide

This doc explains how to test Xero locally and how to use the APIs for invoices, tracking categories, and bank transactions.

## Official Links

- Xero Developer Portal: https://developer.xero.com/
- OAuth 2.0 overview: https://developer.xero.com/documentation/guides/oauth2/overview/
- Getting started / demo company FAQ: https://developer.xero.com/faq/getting-started
- Accounting API invoices: https://developer.xero.com/documentation/api/accounting/invoices
- Accounting API tracking categories: https://developer.xero.com/documentation/api/accounting/trackingcategories
- Accounting API bank transactions: https://developer.xero.com/documentation/api/accounting/banktransactions

## Testing With a Demo Company

Before calling the API, use a Xero demo company. This gives you safe test data without touching a real business account.

Xero's demo company contains fictional data and resets automatically, so it is useful for local development and API testing.

### Setup Flow

1. Sign in to Xero.
2. Open **My Xero**.
3. Select **Try the Demo Company**.
4. Go to the Xero Developer Portal.
5. Create an app.
6. Add your local redirect URI, for example:

```text
http://localhost:3000/xero/callback
```

7. Run the OAuth flow from your app.
8. When Xero asks which organisation to connect, select the demo company.
9. Exchange the OAuth `code` for an access token.
10. Call `/connections` to get the demo company's `tenantId`.

Every Accounting API request needs these headers:

```http
Authorization: Bearer ACCESS_TOKEN
xero-tenant-id: TENANT_ID
Accept: application/json
Content-Type: application/json
```

## Access Token Flow

Open the authorize URL:

```text
https://login.xero.com/identity/connect/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/xero/callback&scope=openid profile email accounting.transactions accounting.settings offline_access&state=123
```

After login, Xero redirects back with:

```text
http://localhost:3000/xero/callback?code=AUTH_CODE&state=123
```

Exchange the `code`:

```bash
curl -X POST https://identity.xero.com/connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE" \
  -d "redirect_uri=http://localhost:3000/xero/callback"
```

Get connected Xero organisations:

```bash
curl https://api.xero.com/connections \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Use the returned `tenantId` as `xero-tenant-id`.

## 1. Invoices API

Use this when you want to create or update customer invoices or supplier bills.

Official docs: https://developer.xero.com/documentation/api/accounting/invoices

Required scope:

```text
accounting.transactions
```

### Add Invoice

Endpoint:

```http
PUT https://api.xero.com/api.xro/2.0/Invoices
```

Example:

```json
{
  "Invoices": [
    {
      "Type": "ACCREC",
      "Contact": {
        "Name": "Demo Customer"
      },
      "Date": "2026-05-14",
      "DueDate": "2026-05-21",
      "LineItems": [
        {
          "Description": "Consulting service",
          "Quantity": 1,
          "UnitAmount": 500,
          "AccountCode": "200",
          "Tracking": [
            {
              "Name": "Region",
              "Option": "North"
            }
          ]
        }
      ],
      "Status": "DRAFT"
    }
  ]
}
```

Plain meaning:

- `Type: ACCREC` means sales invoice.
- `Contact` is the customer.
- `LineItems` are the invoice rows.
- `AccountCode` is the revenue account.
- `Tracking` is optional reporting metadata, such as region or department.
- `Status: DRAFT` creates a draft invoice.

### Update Invoice

Endpoint:

```http
POST https://api.xero.com/api.xro/2.0/Invoices/{InvoiceID}
```

Example:

```json
{
  "Invoices": [
    {
      "InvoiceID": "INVOICE_GUID",
      "Reference": "Updated from local test",
      "LineItems": [
        {
          "Description": "Updated consulting service",
          "Quantity": 2,
          "UnitAmount": 500,
          "AccountCode": "200"
        }
      ]
    }
  ]
}
```

Use `GET /Invoices` first if you need to find the real `InvoiceID`.

Note: Xero also supports `POST /Invoices` as an update-or-create collection endpoint. For clarity, use `PUT /Invoices` when you are intentionally creating invoices and `POST /Invoices/{InvoiceID}` when updating one invoice.

## 2. Categories API

In Xero Accounting, "categories" usually means **Tracking Categories**.

Example:

```text
Tracking Category: Region
Options: North, South, Eastside, West Coast
```

You attach these options to invoice or transaction line items so reports can be split by region, department, project, etc.

Official docs: https://developer.xero.com/documentation/api/accounting/trackingcategories

Required scope:

```text
accounting.settings
```

### Add Tracking Category

Endpoint:

```http
PUT https://api.xero.com/api.xro/2.0/TrackingCategories
```

Example:

```json
{
  "Name": "Department"
}
```

### Update Tracking Category

Endpoint:

```http
POST https://api.xero.com/api.xro/2.0/TrackingCategories/{TrackingCategoryID}
```

Example:

```json
{
  "Name": "Business Unit",
  "Status": "ACTIVE"
}
```

### Add Tracking Option

Endpoint:

```http
PUT https://api.xero.com/api.xro/2.0/TrackingCategories/{TrackingCategoryID}/Options
```

Example:

```json
{
  "Name": "Engineering"
}
```

### Update Tracking Option

Endpoint:

```http
POST https://api.xero.com/api.xro/2.0/TrackingCategories/{TrackingCategoryID}/Options/{TrackingOptionID}
```

Example:

```json
{
  "Name": "Product Engineering",
  "Status": "ACTIVE"
}
```

Use `GET /TrackingCategories` first to get valid `TrackingCategoryID` and `TrackingOptionID` values.

## 3. Transactions API

In this doc, "transactions" means **Bank Transactions** because Xero has a specific Accounting API resource named `BankTransactions`.

Official docs: https://developer.xero.com/documentation/api/accounting/banktransactions

Required scope:

```text
accounting.transactions
```

### Add Bank Transaction

Endpoint:

```http
PUT https://api.xero.com/api.xro/2.0/BankTransactions
```

Example:

```json
{
  "BankTransactions": [
    {
      "Type": "RECEIVE",
      "Contact": {
        "Name": "Demo Customer"
      },
      "Date": "2026-05-14",
      "BankAccount": {
        "AccountID": "BANK_ACCOUNT_GUID"
      },
      "LineItems": [
        {
          "Description": "Payment received",
          "Quantity": 1,
          "UnitAmount": 500,
          "AccountCode": "200",
          "Tracking": [
            {
              "Name": "Region",
              "Option": "North"
            }
          ]
        }
      ]
    }
  ]
}
```

Plain meaning:

- `Type: RECEIVE` means money received into the bank account.
- `Type: SPEND` means money spent from the bank account.
- `BankAccount.AccountID` must be a real Xero bank account GUID.
- `LineItems` explain what the transaction is for.

To get a valid bank account ID:

```http
GET https://api.xero.com/api.xro/2.0/Accounts?where=Type=="BANK"
```

Do not use placeholder values like `12345`; Xero expects real GUIDs.

### Update Bank Transaction

Endpoint:

```http
POST https://api.xero.com/api.xro/2.0/BankTransactions/{BankTransactionID}
```

Example:

```json
{
  "BankTransactions": [
    {
      "BankTransactionID": "BANK_TRANSACTION_GUID",
      "Reference": "Updated from local test",
      "LineItems": [
        {
          "Description": "Updated payment description",
          "Quantity": 1,
          "UnitAmount": 500,
          "AccountCode": "200"
        }
      ]
    }
  ]
}
```

Use `GET /BankTransactions` first if you need to find the real `BankTransactionID`.

Note: Xero also supports `POST /BankTransactions` as an update-or-create collection endpoint. For clarity, use `PUT /BankTransactions` when you are intentionally creating bank transactions and `POST /BankTransactions/{BankTransactionID}` when updating one bank transaction.

## Common Mistakes

- Using XPM Public API when you need Accounting API.
- Missing OAuth scopes.
- Using fake IDs like `12345` instead of Xero GUIDs.
- Forgetting the `xero-tenant-id` header.
- Confusing tracking categories with invoice categories.
- Trying to update approved or reconciled records without checking Xero's allowed state transitions.

## Quick Endpoint Summary

| Purpose | Method | Endpoint | Scope |
| --- | --- | --- | --- |
| Add invoice | `PUT` | `/Invoices` | `accounting.transactions` |
| Update invoice | `POST` | `/Invoices/{InvoiceID}` | `accounting.transactions` |
| Add tracking category | `PUT` | `/TrackingCategories` | `accounting.settings` |
| Update tracking category | `POST` | `/TrackingCategories/{TrackingCategoryID}` | `accounting.settings` |
| Add tracking option | `PUT` | `/TrackingCategories/{TrackingCategoryID}/Options` | `accounting.settings` |
| Update tracking option | `POST` | `/TrackingCategories/{TrackingCategoryID}/Options/{TrackingOptionID}` | `accounting.settings` |
| Add bank transaction | `PUT` | `/BankTransactions` | `accounting.transactions` |
| Update bank transaction | `POST` | `/BankTransactions/{BankTransactionID}` | `accounting.transactions` |
