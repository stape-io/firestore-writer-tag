# Firestore Writer tag for Google Tag Manager Server Side

Firestore Writer tag allows recording data from server Google Tag Manager to Firestore.

**Features:**

- **Add Event Data** - send all sGTM event data to the Firestore document.
- **Merge document keys** - update only the top-level fields written by the tag instead of overwriting the whole document.
- **Override GCP Project ID** - write to a Google Cloud project other than the one the server container runs in.
- **Use custom database** - write to a named Firestore database instead of the `(default)` one.
- **Add TTL field** - add an expiration date field so Firestore can delete the document automatically with a [TTL policy](https://firebase.google.com/docs/firestore/ttl).
- **Add Timestamp** - add the current timestamp in milliseconds.
- **Custom Data** - add custom fields. Use dot notation (e.g. `user.address.city`) to write nested fields.
- **Use Optimistic Scenario** - call `gtmOnSuccess()` without waiting for the write result. Speeds up sGTM response time, but the tag reports success even if the write fails.

**To set up the Firestore Writer tag, you'll need:**

- [Google Service Account](https://stape.io/blog/write-data-to-firestore-from-server-google-tag-manager#1-google-service-account-connected-to-stape)
- [Firebase account](https://stape.io/blog/write-data-to-firestore-from-server-google-tag-manager#2-firebase-account)

### Custom database and TTL

The built-in GTM `Firestore` API only supports the `(default)` database and can't write Timestamp values. When **Use custom database** or **Add TTL field** is enabled, the tag writes through the [Firestore REST API](https://firebase.google.com/docs/firestore/use-rest-api) instead, using the same Google credentials. In this mode, the **GCP Project ID** field is required.

**Add TTL field:**

- The field is written as a Firestore Timestamp (`Date and time`) value, set to the current time plus the **TTL value (seconds)**.
- The field name is configurable and defaults to `expiresAt`. It must match the field of the TTL policy.
- [Create a TTL policy](https://firebase.google.com/docs/firestore/ttl#create_ttl_policy) for the collection group and field in the Google Cloud console. Without it, nothing is deleted.
- Expired documents are typically deleted within 24 hours after their expiration date.

### How to use Firestore Writer tag

- [Write data to Firestore from server Google Tag Manager](https://stape.io/blog/write-data-to-firestore-from-server-google-tag-manager)

### Useful Resources

- https://stape.io/solutions/firestore-writer-tag
- https://stape.io/blog/write-data-to-firestore-from-server-google-tag-manager

## Open Source

Firestore Writer Tag for GTM Server Side is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🟢 [Listed](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/firestore-writer-tag)
