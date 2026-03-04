# twilio v1

Generated Twilio mobile messaging workflow package for Hazlo.

## Summary

- Provider: `twilio`
- Scope: send mobile SMS/MMS and retrieve message status/activity
- Source: OpenAPI import from Twilio REST API (message endpoints)

## Included Workflows

- `twilio/BuildMobileSendRequest/v1`
- `twilio/CreateMessage/v1`
- `twilio/ListMessage/v1`
- `twilio/FetchMessage/v1`
- `twilio/UpdateMessage/v1`
- `twilio/CreateMessageFeedback/v1`

## Default Install Refs

- `twilio/CreateMessage/v1`
- `twilio/ListMessage/v1`
- `twilio/FetchMessage/v1`

## Auth Input

These workflows use Twilio HTTP Basic auth via input key `authAccountSidAuthToken`.
Pass a base64 value of `<AccountSid>:<AuthToken>`.

## Smoke Coverage

Deterministic smoke test uses `twilio/BuildMobileSendRequest/v1` with fixtures under `factory/fixtures`.
