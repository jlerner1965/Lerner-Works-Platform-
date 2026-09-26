import { common, page, p, h2, list, dateKey, nextThanksgiving, shiftDate, type FixtureSite, type FixtureItem } from "@/server/demo/fixtures/types";

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
      image: { key: "store-longmont", title: "Range Athletics Longmont storefront", alt: "Illustrated storefront with a navy facade and orange awning reading Range Athletics", scene: { type: "storefront", sign: "Range Athletics", awning: "#bf4a0d", wall: "#12213a", trim: "#0b1526", seed: 101, detail: "gear" } },
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
      image: { key: "store-boulder", title: "Range Athletics Boulder storefront", alt: "Illustrated downtown storefront with a navy awning and a bicycle drawn beside the sign", scene: { type: "storefront", sign: "Range Athletics", awning: "#12213a", wall: "#e6e9ee", trim: "#bf4a0d", seed: 113, detail: "bike" } },
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
      image: { key: "store-fort-collins", title: "Range Athletics Fort Collins storefront", alt: "Illustrated storefront with a grey facade and an orange awning", scene: { type: "storefront", sign: "Range Athletics", awning: "#bf4a0d", wall: "#7d8da0", trim: "#12213a", seed: 127, detail: "gear" } },
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
          { id: "s-hero", type: "text_hero", heading: "Gear for the Front Range, from people who use it", subheading: "Three stores, real hours, and services you can ask about before you drive over. No online checkout: come in, or send a store a question.", ctaLabel: "Find a store", ctaPath: "/locations" },
          { id: "s-stores", type: "location_collection", heading: "Find a store", mode: "all", itemIds: [] },
          { id: "s-services", type: "content_collection", heading: "Services", kind: "service", mode: "latest", itemIds: [], limit: 4 },
          { id: "s-featured", type: "location_collection", heading: "Featured store", mode: "selected", itemIds: ["@store-longmont"] as unknown as string[] },
          { id: "s-contact", type: "contact_callout", heading: "Questions? Ask a store", text: "Each store answers its own inquiries. Choose the store on the contact page and you will hear back from the people who work there.", showContactDetails: true },
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
          { id: "s-about", type: "rich_text", heading: "About Range Athletics", body: [
            p("Range Athletics is a fictional retailer created to demonstrate a multi-location business website. The stores, addresses, phone numbers and people on this site do not exist; the hours and services are realistic examples, not claims about any real business."),
            h2("What a real store site would do"),
            list("Publish hours per store with date exceptions, and say so when hours are unknown", "List which services each store actually offers", "Route questions to the store that can answer them"),
            h2("What it deliberately does not do"),
            p("There is no inventory, no prices and no availability promise on this site. Those claims need a live connection to the stores' systems; without one, the honest choice is to let you ask."),
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
    },
    items: [...pages, ...services, ...stores, draft, pendingReview],
    secondRelease: {
      note: `Longmont adds an inventory-count closure on ${inventoryDay}`,
      apply: (items) => items.map((it) => (it.externalId === "store-longmont" ? { ...it, payload: { ...it.payload, exceptions: [...(it.payload.exceptions as unknown[]), { date: inventoryDay, label: "Inventory count", closed: false, intervals: [iv("13:00", "20:00")] }], lastVerifiedOn: dateKey(now, 0, TZ) } } : it)),
    },
    inquiry: { name: "Demo customer (fixture)", email: "customer@fixture.example", message: "[Demo fixture] Do you have wide-size trail shoes in stock at Longmont, and can I book a fitting on Saturday morning?", sourcePath: "/locations/longmont", externalId: "store-longmont" },
  };
}
