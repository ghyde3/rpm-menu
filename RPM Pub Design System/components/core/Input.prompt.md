**Input** — labeled dark text field for the CMS. Border lights red on focus.

```jsx
<Input label="Item Name" value={name} onChange={e => setName(e.target.value)} placeholder="Monster Reuben" />
<Input label="Price" prefix="$" value={price} onChange={...} hint="Cents render as superscript on the board" />
```

`label`, `hint`, `prefix` optional. Use `prefix="$"` on price fields. For long copy use `Textarea` instead.
