// RPM menu data — transcribed from the printed board. Shared by all UI kits.
// Prices are numbers; cents render as superscript via PriceTag.
window.RPM_MENU = {
  restaurant: {
    name: "RPM",
    tagline: "Full Service Patio Pub & Grill",
    location: "Historic Downtown Newnan, GA",
    hours: "Kitchen til 10 · Bar til Late",
  },
  categories: [
    {
      id: "sandwiches",
      title: "Sandwiches · Baskets · Dogs",
      stars: true,
      color: "var(--accent-primary)",
      intro: "Sub tortilla wraps for any sandwich +1.50 · all sandwich prices include one side of your choice.",
      items: [
        { name: "Blackened Chicken BLT", price: 12.99, description: "Blackened chicken breast with lettuce, tomato, bacon & our delicious basil aioli on a ciabatta bun.", note: "sub grilled salmon 15.99" },
        { name: "The Philly", price: 13.99, description: "Prime rib or chicken chopped w/ sautéed onions & peppers covered w/ provo on a hoagie." },
        { name: "Monster Reuben", price: 15.99, description: "Corned beef, kraut, swiss & thousand island on toasted marble rye.", note: "half 12.99", tags: [{ label: "Fan Fave", tone: "fave" }] },
        { name: "Cod of Thunder", price: 16.99, description: "Our monster po' boy stuffed w/ fried cod, shrimp, lettuce, tomato & topped w/ chipotle aioli." },
        { name: "Fish & Chips", price: 12.99, description: "Beer battered cod served w/ homemade slaw & tartar sauce." },
        { name: "The Angler", price: 12.99, description: "Beer battered cod on a ciabatta bun w/ lettuce, tomato & bacon, slathered w/ tartar." },
        { name: "The Bratweiler", price: 11.99, description: "Big bratwurst topped w/ sautéed kraut, peppers, onions & sharp cheddar on a hoagie roll." },
        { name: "Chicken Jabroni", price: 11.99, description: "Deep fried chicken breast, tossed in master blaster sauce, covered with blue cheese & pickles on a ciabatta bun.", tags: [{ label: "Master Blaster", tone: "spicy" }] },
        { name: "Chicken Tenders Basket", price: 10.99, description: "Served with your choice of fries, o-rings or tots." },
        { name: "Fried Shrimp Basket", price: 9.99, description: "Comes with a side plus our tartar sauce or cocktail sauce. Try them tossed in your choice of wing sauces!" },
        { name: "The Frankster", price: 13.99, description: "Two all beef jumbo Nathan's topped w/ black bean chili, cheese, jalapenos & slaw on the side.", note: "9.99 / one" },
        { name: "Road Dogs", price: 12.99, description: "Two all beef jumbo Nathan's covered w/ sautéed onions, peppers & kraut.", note: "9.99 / one" },
      ],
    },
    {
      id: "salads",
      title: "Salads",
      color: "var(--accent-primary)",
      items: [
        { name: "Haus Salad", price: 14.99, description: "Fresh bed of greens topped w/ corned beef, kraut, thousand island dressing & fried Bavarian pretzel croutons." },
        { name: "Blackened Salmon Caesar", price: 15.99, description: "North Atlantic salmon over greens tossed with Caesar dressing, shredded parmesan and cracked black pepper." },
        { name: "The Gringo", price: 13.99, description: "Grilled onions and peppers with steak or chicken, atop fresh greens, tomatoes and cheddar with ranch dressing." },
        { name: "The Hungry Hippie", price: 12.99, description: "Big pile of greens, tomatoes, onions, peppers, carrots, cucumber, black bean salad and rye croutons. Your choice of dressing.", tags: [{ label: "Veggie", tone: "veggie" }] },
        { name: "Big-A-Pasta Salad", price: 10.99, description: "Homemade and delicious. Now available in a big bowl!" },
      ],
    },
    {
      id: "sides",
      title: "Sides",
      color: "var(--accent-secondary)",
      items: [
        { name: "The Lineup", price: 4.99, description: "O-rings, tater tots, fries, pork rinds, cole slaw, potato salad, pasta salad, fresh fruit, sautéed veggies, small house salad, black bean salad, soup of the day." },
      ],
    },
    {
      id: "desserts",
      title: "Desserts",
      color: "var(--accent-primary)",
      items: [
        { name: "Cheech & Chong", price: 6.99, description: "Fried cheesecake rolled up fat.", tags: [{ label: "Fan Fave", tone: "fave" }] },
        { name: "Dessert of the Day", price: 0, description: "Ask your server. Prices and availability may differ.", note: "market price" },
      ],
    },
    {
      id: "drinks",
      title: "On Tap · Pepsi Products",
      color: "var(--accent-secondary)",
      intro: "15 rotating drafts + a full bar of spirits & wines.",
      items: [
        { name: "Draft Beer", price: 6.0, description: "15 rotating taps — ask your bartender what's pouring today.", tags: [{ label: "On Tap", tone: "new" }] },
        { name: "Well Spirits", price: 7.0, description: "Great list of spirits. Add a mixer, no charge." },
        { name: "House Wine", price: 8.0, description: "Red or white by the glass." },
        { name: "Fountain", price: 2.99, description: "Pepsi, Diet Pepsi, Dr. Pepper, Mt. Dew, Sierra Mist, Lemonade, Coffee, Sweet & Unsweet Tea." },
      ],
    },
  ],
};
