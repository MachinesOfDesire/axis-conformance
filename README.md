# AXIS Registry Conformance

Runtime-behavior requirements for AXIS-conformant registries. The protocol specification at [MachinesOfDesire/axis-protocol](https://github.com/MachinesOfDesire/axis-protocol) defines the wire contract — record formats, AIT structure, endpoint schemas, verification semantics. This repository defines the operational contract: how a registry implementation MUST behave at runtime.

A registry that wants to call itself AXIS-conformant satisfies BOTH documents.

## Current document

- [Registry Conformance v0.1](./conformance-v0.1.md) — current normative document covering authentication, authorization scoping, audit logging, retention, domain verification, tiered visibility, rate limiting, availability, data handling, and key management.

## Status

Pre-1.0. Breaking changes are possible between minor versions. Track this repository's `CHANGELOG.md` (forthcoming) when one exists.

## Versioning

Conformance versions are independent of the protocol specification version. A registry implementation declares conformance against a specific version of this document (e.g., "AXIS Registry Conformance v0.1") alongside its protocol version.

## License

Apache 2.0. See [LICENSE](./LICENSE).
