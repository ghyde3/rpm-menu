**MenuSection** — a whole board category: `SectionHeader` + a stack of `MenuItem`s. Drive it with an `items` array (recommended for CMS output) or pass children.

```jsx
<MenuSection
  title="Sandwiches · Baskets · Dogs"
  stars
  intro="Sub tortilla wraps for any sandwich +1.50 · all prices include one side"
  items={[
    { name: "Monster Reuben", price: 15.99, description: "Corned beef, kraut, swiss & thousand island on toasted marble rye." },
    { name: "Cod of Thunder", price: 16.99, description: "Monster po' boy stuffed w/ fried cod, shrimp, lettuce, tomato & chipotle aioli." },
  ]}
/>
```

Use `priceSize="lg"` and `headerSize="xl"` on TV boards.
