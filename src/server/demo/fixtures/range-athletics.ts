import { common, page, p, h2, list, divider, note, button, dateKey, nextThanksgiving, shiftDate, type FixtureSite, type FixtureItem } from "@/server/demo/fixtures/types";

const TZ = "America/Denver";
type Interval = { open: string; close: string; closesNextDay: boolean };
const iv = (open: string, close: string, closesNextDay = false): Interval => ({ open, close, closesNextDay });

/** Range Athletics: a fictional Front Range sporting-goods retailer with three stores. */
export function rangeAthleticsFixture(now: Date): FixtureSite {
  const thanksgiving = nextThanksgiving(now, TZ);
  const blackFriday = shiftDate(thanksgiving, 1);
  const inventoryDay = dateKey(now, 9, TZ);

  const services: FixtureItem[] = [
    {
      externalId: "service-shoe-fitting",
      kind: "service",
      payload: {
        ...common({ title: "Run and hike shoe fitting", slug: "shoe-fitting", summary: "A 20-minute fitting on the in-store treadmill with staff who look at how you land, not just what size you wear." }),
        body: [p("Bring the socks you actually run or hike in, and the insoles if you use them. Staff watch you walk and jog, measure both feet, and pull three or four options before you try anything on. There is no charge for the fitting and no obligation to buy."), list("Book ahead on weekends", "Wide and narrow sizes stocked in Longmont", "Trail and road shoes, hiking boots")],
        inquiryPrompt: "Want a fitting at a specific store or time? Ask and we will confirm availability.",
        // A sample document listed as a download under the service (B5-1).
        attachments: [{ assetId: "@doc-fitting-guide", label: "" }],
      },
      image: { key: "svc-shoe", title: "Shoe fitting", alt: "Flat illustration of a running shoe in navy with an orange sole stripe", scene: { type: "icon", icon: "shoe", bg: "#ffffff", fg: "#12213a", accent: "#bf4a0d" } },
    },
    {
      externalId: "service-ski-tuning",
      kind: "service",
      payload: {
        ...common({ title: "Ski and snowboard tuning", slug: "ski-and-snowboard-tuning", summary: "Base grind, edge work and hot wax, usually back within two days. Binding checks by appointment." }),
        body: [p("Tuning runs November through April at the Longmont and Boulder stores. Drop-off is at the service counter; you will get a text when the gear is ready. Binding adjustments and safety checks need the boots and a signed release form."), list("Standard tune: base grind, edges, hot wax", "Rush service when the bench is free", "Skis, snowboards, splitboards")],
        inquiryPrompt: "Not sure whether your bases need a grind or just a wax? Send a photo and we will tell you.",
      },
      image: { key: "svc-ski", title: "Ski tuning", alt: "Flat illustration of two skis crossed with poles", scene: { type: "icon", icon: "ski", bg: "#f5f6f8", fg: "#12213a", accent: "#bf4a0d" } },
    },
    {
      externalId: "service-team-outfitting",
      kind: "service",
      payload: {
        ...common({ title: "Team outfitting", slug: "team-outfitting", summary: "Uniforms, warm-ups and equipment for school and club teams, ordered together with one contact and one invoice." }),
        body: [p("Bring a roster and a rough budget; we come back with samples, a size run for fittings, and a delivery date. Orders go through one coordinator so nobody chases twelve parents for sizes."), list("Numbering and names done locally", "Size runs delivered for fittings", "Youth through adult sizing")],
        inquiryPrompt: "Coaching a team this season? Tell us the sport, roster size and season start.",
      },
      image: { key: "svc-team", title: "Team outfitting", alt: "Flat illustration of a jersey with the number 7", scene: { type: "icon", icon: "jersey", bg: "#ffffff", fg: "#12213a", accent: "#bf4a0d" } },
    },
    {
      externalId: "service-bike-service",
      kind: "service",
      payload: {
        ...common({ title: "Bike service", slug: "bike-service", summary: "Tune-ups, brake bleeds, wheel builds and flats while you wait, from mechanics who ride the same trails." }),
        body: [p("Walk in for flats and quick adjustments; book for full tune-ups and suspension work. The Longmont shop has the suspension bench; Boulder handles most everything else."), list("Flats and quick fixes while you wait", "Full tune-ups by appointment", "Suspension service in Longmont")],
        inquiryPrompt: "Describe the noise or the problem and a mechanic will reply with what to expect.",
      },
      image: { key: "svc-bike", title: "Bike service", alt: "Flat illustration of a wrench", scene: { type: "icon", icon: "wrench", bg: "#f5f6f8", fg: "#12213a", accent: "#bf4a0d" } },
    },
  ];

  const stores: FixtureItem[] = [
    {
      externalId: "store-longmont",
      kind: "store",
      payload: {
        ...common({ title: "Range Athletics Longmont", slug: "longmont", summary: "Flagship store with the full shoe wall, the suspension bench and the winter tuning shop. Easy parking off Foothills Way.", lastVerifiedOn: dateKey(now, -3, TZ) }),
        body: [p("The Longmont store is the original and the largest. The shoe wall runs the length of the back, the service counter handles bikes year-round and skis in season, and the team-outfitting office is upstairs."), h2("Parking and access"), p("Free lot in front; the accessible entrance is the main door. Bike racks are beside the service bay.")],
        address: { line1: "4100 Foothills Way", line2: "Suite 100", locality: "Longmont", region: "CO", postalCode: "80501", approved: false },
        phone: "(720) 555-0191",
        timeZone: TZ,
        weeklyHours: { mon: [iv("09:00", "20:00")], tue: [iv("09:00", "20:00")], wed: [iv("09:00", "20:00")], thu: [iv("09:00", "20:00")], fri: [iv("09:00", "21:00")], sat: [iv("08:00", "21:00")], sun: [iv("10:00", "18:00")] },
        exceptions: [
          { date: thanksgiving, label: "Thanksgiving", closed: true, intervals: [] },
          { date: blackFriday, label: "Black Friday", closed: false, intervals: [iv("06:00", "22:00")] },
        ],
        serviceItemIds: ["@service-shoe-fitting", "@service-ski-tuning", "@service-team-outfitting", "@service-bike-service"] as unknown as string[],
        status: "open",
        statusNote: "",
      },
      // Image keys share the "@" namespace with item external ids, so the pictures' keys differ from the stores' ids.
      image: { key: "longmont-storefront", title: "Range Athletics Longmont storefront", alt: "Illustrated storefront with a navy facade and orange awning reading Range Athletics", scene: { type: "storefront", sign: "Range Athletics", awning: "#bf4a0d", wall: "#12213a", trim: "#0b1526", seed: 101, detail: "gear" } },
    },
    {
      externalId: "store-boulder",
      kind: "store",
      payload: {
        ...common({ title: "Range Athletics Boulder", slug: "boulder", summary: "Downtown store near the creek path with a smaller shoe wall, a busy bike counter and Friday late hours for the trail crowd.", lastVerifiedOn: dateKey(now, -10, TZ) }),
        body: [p("Boulder is the store for people who ride or run straight from the door. The bike counter is open whenever the store is, and Friday evenings run late into the night for group rides that end downtown."), h2("Parking and access"), p("Street parking is limited; the garage on Walnut is two blocks away. The entrance has a short ramp.")],
        address: { line1: "1450 Walnut Street", line2: "", locality: "Boulder", region: "CO", postalCode: "80302", approved: false },
        phone: "(720) 555-0192",
        timeZone: TZ,
        weeklyHours: { mon: [iv("10:00", "19:00")], tue: [iv("10:00", "19:00")], wed: [iv("10:00", "13:00"), iv("14:00", "19:00")], thu: [iv("10:00", "19:00")], fri: [iv("10:00", "01:00", true)], sat: [iv("09:00", "19:00")], sun: [] },
        exceptions: [{ date: thanksgiving, label: "Thanksgiving", closed: true, intervals: [] }],
        serviceItemIds: ["@service-shoe-fitting", "@service-ski-tuning", "@service-bike-service"] as unknown as string[],
        status: "open",
        statusNote: "",
      },
      image: { key: "boulder-storefront", title: "Range Athletics Boulder storefront", alt: "Illustrated downtown storefront with a navy awning and a bicycle drawn beside the sign", scene: { type: "storefront", sign: "Range Athletics", awning: "#12213a", wall: "#e6e9ee", trim: "#bf4a0d", seed: 113, detail: "bike" } },
    },
    {
      externalId: "store-fort-collins",
      kind: "store",
      payload: {
        ...common({ title: "Range Athletics Fort Collins", slug: "fort-collins", summary: "North store with the team-outfitting showroom. Temporarily closed for a floor replacement; reopening date to be announced.", lastVerifiedOn: dateKey(now, -1, TZ) }),
        body: [p("The Fort Collins store is closed while the sales floor is replaced. Team orders continue through the coordinator by phone and email, and shoe fittings are being handled in Longmont in the meantime.")],
        address: { line1: "2200 College Avenue", line2: "", locality: "Fort Collins", region: "CO", postalCode: "80525", approved: false },
        phone: "(970) 555-0193",
        timeZone: TZ,
        weeklyHours: { mon: [iv("10:00", "19:00")], tue: [iv("10:00", "19:00")], wed: [iv("10:00", "19:00")], thu: [iv("10:00", "19:00")], fri: [iv("10:00", "19:00")], sat: [iv("09:00", "18:00")], sun: [iv("11:00", "17:00")] },
        exceptions: [],
        serviceItemIds: ["@service-team-outfitting", "@service-shoe-fitting"] as unknown as string[],
        status: "temporarily_closed",
        statusNote: "Closed for floor replacement; team orders continue by phone",
      },
      image: { key: "fort-collins-storefront", title: "Range Athletics Fort Collins storefront", alt: "Illustrated storefront with a grey facade and an orange awning", scene: { type: "storefront", sign: "Range Athletics", awning: "#bf4a0d", wall: "#7d8da0", trim: "#12213a", seed: 127, detail: "gear" } },
    },
  ];

  // Links to other websites (B5-2): the clubs and resources the stores send people to.
  const links: FixtureItem[] = [
    {
      externalId: "link-trail-runners",
      kind: "link",
      payload: {
        ...common({ title: "Front Range Trail Runners", slug: "front-range-trail-runners", summary: "The club whose Saturday runs leave from the Boulder store's lot: calendar, pace groups and the shoe-demo mornings we host together.", lastVerifiedOn: dateKey(now, -4, TZ) }),
        featuredImageAssetId: "@front-range",
        url: "https://frontrangetrailrunners.example",
        category: "Clubs",
        ctaLabel: "See the run calendar",
      },
    },
    {
      externalId: "link-snow-safety",
      kind: "link",
      payload: {
        ...common({ title: "Backcountry snow safety evenings", slug: "backcountry-snow-safety", summary: "The avalanche awareness evenings the tuning bench sends every new backcountry customer to, run by a fictional non-profit. Free; register on their site.", lastVerifiedOn: dateKey(now, -4, TZ) }),
        url: "https://snowsafety.example/evenings",
        category: "Safety",
        ctaLabel: "Find an evening",
      },
    },
  ];

  const pages: FixtureItem[] = [
    {
      externalId: "page-home",
      kind: "page",
      payload: page({
        title: "Home",
        slug: "home",
        summary: "Range Athletics is a fictional Front Range sporting-goods retailer with three stores, honest hours and services you can ask about before you drive.",
        metaDescription: "Range Athletics (fictional): three Colorado stores, current hours, shoe fitting, ski tuning, team outfitting and bike service.",
        sections: [
          { id: "s-hero", type: "image_hero", variant: "full", overlay: "medium", heading: "Gear for the Front Range, from people who use it", subheading: "Three stores, real hours, and services you can ask about before you drive over. No online checkout: come in, or send a store a question.", imageAssetId: "@front-range" as unknown as null, ctaLabel: "Find a store", ctaPath: "/locations" },
          { id: "s-stores", type: "location_collection", heading: "Find a store", mode: "all", itemIds: [] },
          { id: "s-facts", type: "facts", heading: "", variant: "inline", items: [
            { label: "Stores", value: "3 on the Front Range" },
            { label: "Services", value: "4, each with the stores that offer it" },
            { label: "Founded", value: "1998 (fictional)" },
          ] },
          { id: "s-why", type: "image_text", heading: "Why people drive to us", items: [
            { assetId: "@longmont-storefront", heading: "A shoe wall with people who watch you run", body: [p("Twenty minutes on the treadmill, both feet measured, three or four options pulled before you try anything on. No charge, no obligation, and the socks you actually run in.")], ctaLabel: "Book a fitting", ctaPath: "/services/shoe-fitting" },
            { assetId: "@boulder-storefront", heading: "A bike counter open whenever the store is", body: [p("Flats and quick adjustments while you wait, full tune-ups by appointment, and Friday nights that run late for the group rides that end downtown.")], ctaLabel: "Bike service", ctaPath: "/services/bike-service" },
          ] },
          { id: "s-services", type: "content_collection", heading: "Services", kind: "service", mode: "latest", itemIds: [], limit: 4, variant: "cards", columns: 4 },
          { id: "s-band", type: "image_band", heading: "Winter tuning is open", text: "Base grind, edge work and hot wax at Longmont and Boulder, usually back within two days.", imageAssetId: "@front-range" as unknown as null, tint: "primary", strength: "strong", ctaLabel: "Book a tune", ctaPath: "/services/ski-and-snowboard-tuning", secondaryLabel: "Find a store", secondaryPath: "/locations", appearance: { align: "center" } },
          { id: "s-featured", type: "location_collection", heading: "Featured store", mode: "selected", itemIds: ["@store-longmont"] as unknown as string[] },
          { id: "s-voices", type: "quotes", heading: "What customers say", variant: "grid", appearance: { background: "tint" }, items: [
            { text: "They watched me run before they sold me anything. The shoes fit, and my knees stopped complaining.", attribution: "Sam Delgado", role: "Runs the Boulder creek path (fictional)", assetId: "@portrait-sam" },
            { text: "The site said Fort Collins was closed for the floor. It was. That is worth more than a slogan.", attribution: "Ruth Kimani", role: "Team coordinator, north county (fictional)", assetId: "@portrait-ruth" },
          ] },
          { id: "s-people", type: "team", heading: "At the counter", intro: "The people who answer the store inquiries. All three are fictional.", items: [
            { name: "Priya Natarajan", role: "Store manager, Longmont", text: "Runs the shoe wall and the fitting bookings.", assetId: "@portrait-priya", path: "/locations/longmont" },
            { name: "Cole Whitfield", role: "Head mechanic", text: "Suspension bench in Longmont, tuning in season.", assetId: "@portrait-cole", path: "" },
            { name: "Lena Ortiz", role: "Team outfitting", text: "One coordinator, one invoice, size runs delivered for fittings.", assetId: "@portrait-lena", path: "/services/team-outfitting" },
          ] },
          { id: "s-brands", type: "logo_strip", heading: "Brands we fit", variant: "mono", items: [
            { assetId: "@mark-ridgeline", label: "", path: "" },
            { assetId: "@mark-northfork", label: "", path: "" },
            { assetId: "@mark-summit", label: "", path: "" },
            { assetId: "@mark-cycle", label: "", path: "" },
          ] },
          // Cards that open other websites (B5-2), filled from the published links.
          { id: "s-links", type: "content_collection", heading: "Clubs and resources", kind: "link", mode: "latest", itemIds: [], limit: 2, variant: "cards", columns: 2 },
          { id: "s-contact", type: "cta_banner", heading: "Questions? Ask a store", text: "Each store answers its own inquiries. Choose the store on the contact page and you will hear back from the people who work there.", ctaLabel: "Contact us", ctaPath: "/contact", appearance: { background: "accent", align: "center" } },
        ],
      }),
    },
    {
      externalId: "page-about",
      kind: "page",
      payload: page({
        title: "About",
        slug: "about",
        summary: "What Range Athletics is, and what this demonstration site is and is not.",
        sections: [
          // The statement treatment (B3): an oversized heading with the picture beneath.
          { id: "s-about-hero", type: "image_hero", variant: "statement", heading: "Honest hours. Real people.", subheading: "What Range Athletics is, and what this demonstration site is and is not.", imageAssetId: "@longmont-storefront" as unknown as null, ctaLabel: "", ctaPath: "" },
          { id: "s-about", type: "rich_text", heading: "About Range Athletics", body: [
            p("Range Athletics is a fictional retailer created to demonstrate a multi-location business website. The stores, addresses, phone numbers and people on this site do not exist; the hours and services are realistic examples, not claims about any real business."),
            h2("What a real store site would do"),
            list("Publish hours per store with date exceptions, and say so when hours are unknown", "List which services each store actually offers", "Route questions to the store that can answer them"),
            divider(),
            h2("What it deliberately does not do"),
            p("There is no inventory, no prices and no availability promise on this site. Those claims need a live connection to the stores' systems; without one, the honest choice is to let you ask."),
            note("Want to know whether a size is on the shelf? Send the store a question with the model and size and the floor staff will check."),
            button("Ask a store", "/contact"),
          ] },
          { id: "s-stores-gallery", type: "gallery", heading: "Three stores", variant: "grid", columns: 3, aspect: "landscape", lightbox: true, items: [
            { assetId: "@longmont-storefront", caption: "Longmont: the flagship on Foothills Way" },
            { assetId: "@boulder-storefront", caption: "Boulder: downtown on Walnut Street" },
            { assetId: "@fort-collins-storefront", caption: "Fort Collins: closed while the floor is replaced" },
          ] },
          // Documents from the media library listed as downloads (B5-1): sample PDFs written by the fixture generator.
          { id: "s-downloads", type: "downloads", variant: "grid", heading: "Forms and guides", items: [
            { assetId: "@doc-fitting-guide", label: "", note: "What to bring to a shoe fitting." },
            { assetId: "@doc-team-order-form", label: "Team order form", note: "For coaches ordering for a squad." },
          ] },
        ],
      }),
    },
    {
      externalId: "page-contact",
      kind: "page",
      payload: page({
        title: "Contact",
        slug: "contact",
        summary: "Ask a store about a service, a fitting or an order. Choose the store so the right people answer.",
        sections: [
          { id: "s-callout", type: "contact_callout", heading: "Contact us", text: "Company questions go to the address below. Store questions are best sent through the form with the store selected.", showContactDetails: true },
          { id: "s-form", type: "inquiry_form", heading: "Send an inquiry", intro: "Tell us what you need and which store you would visit. You will get a receipt reference right away.", locationSelect: true },
          { id: "s-faq", type: "faq", heading: "Before you ask", items: [
            { question: "Can you tell me whether a size is in stock?", answer: [p("Not from this site: there is no live inventory here. Send the store a question with the model and size and the floor staff will check the shelf and answer.")] },
            { question: "How long does a ski tune take?", answer: [p("Same day if you drop off before noon at Boulder or Longmont, otherwise next day. Race tunes and base repairs are quoted in the store.")] },
            { question: "Do you ship?", answer: [p("No. Everything is collected in a store; that is how the fitting and tuning services stay honest.")] },
          ] },
          // Click-to-load map (B3): coordinates for the map on request; nothing loads on a demonstration site.
          { id: "s-office", type: "map_link", variant: "card", heading: "Head office", text: "Range Athletics Inc. is run from the Longmont store's upper floor. Deliveries and team orders go here.", label: "Get directions", provider: "google", embed: true, latitude: 40.1672, longitude: -105.1019, address: { line1: "4100 Foothills Way", line2: "Suite 200", locality: "Longmont", region: "CO", postalCode: "80501", approved: false } },
        ],
      }),
    },
  ];

  const draft: FixtureItem = {
    externalId: "service-ski-rental",
    kind: "service",
    leaveAsDraft: true,
    payload: {
      ...common({ title: "Ski rental", slug: "ski-rental", summary: "Seasonal rental packages, planned for this winter. Draft; not yet approved for publication." }),
      body: [p("Draft service description. Pricing and store availability have not been confirmed.")],
      inquiryPrompt: "",
    },
  };
  const pendingReview: FixtureItem = {
    externalId: "page-team-night",
    kind: "page",
    submitForReview: true,
    payload: page({
      title: "Team night",
      slug: "team-night",
      summary: "A proposed page for the monthly team-night event at the Longmont store. Submitted for review.",
      sections: [{ id: "s-team", type: "rich_text", heading: "Team night at Longmont", body: [p("Once a month the Longmont store stays open late for coaches and team coordinators: size runs on the floor, ordering help and a discount on team basics. Dates to be confirmed by the store manager.")] }],
    }),
  };

  return {
    key: "range-athletics",
    config: {
      tagline: "Three Colorado stores (fictional demonstration)",
      footerText: "Range Athletics is a fictional retailer built to demonstrate a multi-location business website. No products, prices or inventory are offered.",
      defaultDescription: "Range Athletics (fictional): three Colorado stores with current hours, shoe fitting, ski tuning, team outfitting and bike service.",
      logoImageKey: "logo",
      design: { radius: "small" },
    },
    images: [
      { key: "logo", title: "Range Athletics logo", alt: "Range Athletics", scene: { type: "logo", lines: ["Range", "ATHLETICS"], fg: "#12213a", accent: "#bf4a0d", emblem: "peak" } },
      { key: "front-range", title: "Front Range foothills at dusk", alt: "Illustrated foothills under a dusk sky, with a ridge line and a valley road", scene: { type: "landscape", palette: "dusk", seed: 7, ratio: "wide" }, focal: { x: 0.5, y: 0.38 } },
      // Portraits of the fictional staff and customers (B3: the people section, quotations with a portrait).
      { key: "portrait-priya", title: "Priya Natarajan", alt: "Stylised portrait of Priya Natarajan, the fictional Longmont store manager", scene: { type: "portrait", initials: "PN", bg: "#e6e9ee", fg: "#12213a", accent: "#bf4a0d", seed: 31 } },
      { key: "portrait-cole", title: "Cole Whitfield", alt: "Stylised portrait of Cole Whitfield, the fictional head mechanic", scene: { type: "portrait", initials: "CW", bg: "#f5f6f8", fg: "#0b1526", accent: "#bf4a0d", seed: 34 } },
      { key: "portrait-lena", title: "Lena Ortiz", alt: "Stylised portrait of Lena Ortiz, the fictional team outfitting coordinator", scene: { type: "portrait", initials: "LO", bg: "#fbe7d9", fg: "#12213a", accent: "#7d8da0", seed: 38 } },
      { key: "portrait-sam", title: "Sam Delgado", alt: "Stylised portrait of Sam Delgado, a fictional customer", scene: { type: "portrait", initials: "SD", bg: "#e6e9ee", fg: "#3e4a5f", accent: "#bf4a0d", seed: 41 } },
      { key: "portrait-ruth", title: "Ruth Kimani", alt: "Stylised portrait of Ruth Kimani, a fictional customer", scene: { type: "portrait", initials: "RK", bg: "#f2e6cf", fg: "#12213a", accent: "#bf4a0d", seed: 44 } },
      // Marks of the fictional brands the stores fit (B3: logo strip).
      { key: "mark-ridgeline", title: "Ridgeline Footwear mark", alt: "Ridgeline Footwear (fictional brand)", scene: { type: "logo", lines: ["Ridgeline", "FOOTWEAR"], fg: "#12213a", accent: "#bf4a0d", emblem: "peak" } },
      { key: "mark-northfork", title: "North Fork Skis mark", alt: "North Fork Skis (fictional brand)", scene: { type: "logo", lines: ["North Fork", "SKIS"], fg: "#0b1526", accent: "#7d8da0", emblem: "shield" } },
      { key: "mark-summit", title: "Summit Company mark", alt: "Summit Company (fictional brand)", scene: { type: "logo", lines: ["Summit", "COMPANY"], fg: "#3e4a5f", accent: "#bf4a0d", emblem: "sun" } },
      { key: "mark-cycle", title: "Boulder Cycle Works mark", alt: "Boulder Cycle Works (fictional brand)", scene: { type: "logo", lines: ["Boulder", "CYCLE WORKS"], fg: "#12213a", accent: "#bf4a0d", emblem: "ring" } },
    ],
    // Sample documents (B5-1): one-page PDFs written by the fixture generator, never real records.
    documents: [
      { key: "doc-fitting-guide", title: "Shoe fitting: what to bring", spec: { title: "Shoe fitting: what to bring", lines: ["Range Athletics (fictional demonstration)", "", "- The socks you run or hike in", "- Your insoles, if you use them", "- Your current shoes, worn", "", "Allow twenty minutes. There is no charge and no obligation to buy."] } },
      { key: "doc-team-order-form", title: "Team order form", spec: { title: "Team order form", lines: ["Range Athletics (fictional demonstration)", "", "Team: ______________________________", "Coach: _____________________________", "Sizes and quantities on the reverse.", "", "Orders placed by the first of the month ship by the twentieth."] } },
    ],
    items: [...pages, ...services, ...stores, ...links, draft, pendingReview],
    secondRelease: {
      note: `Longmont adds an inventory-count closure on ${inventoryDay}`,
      apply: (items) => items.map((it) => (it.externalId === "store-longmont" ? { ...it, payload: { ...it.payload, exceptions: [...(it.payload.exceptions as unknown[]), { date: inventoryDay, label: "Inventory count", closed: false, intervals: [iv("13:00", "20:00")] }], lastVerifiedOn: dateKey(now, 0, TZ) } } : it)),
    },
    inquiry: { name: "Demo customer (fixture)", email: "customer@fixture.example", message: "[Demo fixture] Do you have wide-size trail shoes in stock at Longmont, and can I book a fitting on Saturday morning?", sourcePath: "/locations/longmont", externalId: "store-longmont" },
  };
}
