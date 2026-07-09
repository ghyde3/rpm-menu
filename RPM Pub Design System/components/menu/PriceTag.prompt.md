**PriceTag** — the signature board price: big dollars, small raised cents (12⁹⁹). Amber by default.

```jsx
<PriceTag price={12.99} />
<PriceTag price="15" size="lg" />        {/* renders 15⁰⁰ */}
<PriceTag price={9.99} size="sm" color="var(--text-secondary)" />
```

Sizes: `sm | md | lg | xl`. Always the amber highlight color unless overridden.
