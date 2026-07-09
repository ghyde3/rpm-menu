**MenuItem** — the core board row. Flame-orange italic caps title, dotted leader to an amber price, slab description, optional tags. The heart of every RPM menu surface.

```jsx
<MenuItem
  name="Monster Reuben"
  price={15.99}
  description="Corned beef, kraut, swiss & thousand island on toasted marble rye."
  note="half 12.99"
  tags={[{ label: "Fan Fave", tone: "fave" }]}
/>
<MenuItem name="Cheech & Chong" price={6.99} description="Fried cheesecake rolled up fat." available={false} />
```

Set `available={false}` to 86 an item (dims + strikethrough). `priceSize="lg"` for TV boards. Composes `PriceTag` + `Tag`.
