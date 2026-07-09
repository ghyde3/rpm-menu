**Switch** — availability toggle. Green = available; off = "86'd" (out). Use in the CMS item list to pull items from the live board instantly.

```jsx
<Switch checked={item.available} onChange={v => setAvailable(v)} label="On the board" />
```
