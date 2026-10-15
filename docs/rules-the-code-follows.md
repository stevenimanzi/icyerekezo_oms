# Rules the code follows

These are rules that are not obvious from reading one file. If you change the code, keep them true.

## Sign in and registration
- Signing in takes the same time and gives the same answer whether or not the email exists. This stops people from discovering which emails are registered.
- "Forgot password" and "resend code" give the same reply for any email, for the same reason.
- A registration that was never confirmed with its code does not keep its email address. The next attempt removes the unconfirmed account (and the factory it created) so the person can start again.

## Files
- Invoices, payment proofs and agreements are stored privately. They can only be opened through short-lived signed links, never by a public address.

## Stock
- Stock is an append-only ledger. A mistake is fixed by posting a reversing entry, never by editing an old one.
- A low-stock alert is sent only when stock crosses below the reorder level, not on every withdrawal while it is already low.
- Items that are tracked by batch must always name a batch, and the batch must belong to that item. The one exception is the "packed" step, where work-in-progress fabric becomes the finished product.
- Only a warehouse keeper may edit older stock movements.
- Delivering an order never fails because the stock movement could not be posted. If no single warehouse holds enough, the stock step is skipped and the delivery is still recorded.

## Orders, packing and delivery
- Packing records what is physically ready. It never changes the delivered quantity, stock or order status.
- Delivery can never be more than what was packed. Logistics delivers what packing prepared.
- A product name used on an order (for example "T-shirt") finds or creates its catalogue item the first time it is used, so production and sales always agree on what the product is.
- A missing optional component never blocks approval of a production order.

## Factories and industries
- Setting a factory up from its industry is safe to repeat. It adds what is missing and never deletes departments or history.
- Every factory-owned record belongs to exactly one factory, and every query is limited to the signed-in user's current factory. Code that runs without a signed-in user must name the factory explicitly.

## Do not rename or move
- The Eloquent models, notifications, jobs and mails keep their names and folders. Their class names are stored in the database (audit log, notifications table, queue), so renaming them breaks existing records.
