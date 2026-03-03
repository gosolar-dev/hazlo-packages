# stripe-core v1

Reusable Stripe workflows for Nebula.

## Workflows

- `stripe/getAuthHeader/v1`: builds the Stripe `Authorization` header.
- `stripe/listCustomers/v1`: fetches `GET /v1/customers`.

## Required Environment Variables

- `STRIPE_SECRET_KEY`: Stripe secret key used when `input.bearerToken` is not provided.

## Optional Environment Variables

- `STRIPE_API_BASE`: override base URL (defaults to `https://api.stripe.com`).

## Example

```bash
./bin/nebula workflows eval \
  --ref stripe/listCustomers/v1 \
  --input '{"limit":10,"env":{"STRIPE_SECRET_KEY":"sk_test_123"}}'
```
