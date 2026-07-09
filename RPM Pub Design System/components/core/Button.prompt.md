**Button** — chunky, flat, uppercase action button in hot-rod red; use for all CMS actions and the "Order / Call" CTAs on the customer menu.

```jsx
<Button variant="primary" onClick={save}>Save Menu</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="danger">Delete Item</Button>
```

Variants: `primary` (red fill), `secondary` (outline), `ghost` (text only), `danger` (red outline → red fill on hover). Sizes: `sm | md | lg`. `fullWidth` stretches to container. Press state nudges down 1px; disabled dims to 45%.
