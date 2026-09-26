import { common, page, p, h2, list, localInstant, dateKey, type FixtureSite, type FixtureItem } from "@/server/demo/fixtures/types";

const TZ = "America/Denver";
const verified = (base: Date, daysAgo: number) => dateKey(base, -daysAgo, TZ);

const addr = (line1: string, postal = "80999") => ({ line1, line2: "", locality: "Pine Hollow", region: "CO", postalCode: postal, approved: false });
const hours = (open: string, close: string, days: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">) => {
  const week = { mon: [] as Array<{ open: string; close: string; closesNextDay: boolean }>, tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } as Record<string, Array<{ open: string; close: string; closesNextDay: boolean }>>;
  for (const d of days) week[d] = [{ open, close, closesNextDay: false }];
  return week;
};

/** Pine Hollow Guide: a fictional Colorado mountain-town guide. Every place, person and address is invented. */
export function pineHollowFixture(now: Date): FixtureSite {
  const places: FixtureItem[] = [
    {
      externalId: "place-creekside-coffee",
      kind: "place",
      payload: {
        ...common({ title: "Creekside Coffee Roasters", slug: "creekside-coffee-roasters", summary: "Small-batch roaster on the creek path with a walk-up window, early hours and the town's most reliable weather chatter.", lastVerifiedOn: verified(now, 9), sourceUrl: "https://creekside.example", attribution: "Guide visit and owner interview" }),
        body: [p("Creekside opens before the sun clears the ridge, which is why half the town's dog walkers end up on its bench by seven. The roaster runs Tuesday and Friday mornings; if the door is propped open, you will smell it from the footbridge."), p("Order at the window in summer or inside from October on. Cards and cash are both fine. The creek path behind the building connects to Mill Pond Park in about ten minutes on foot."), h2("Good to know"), list("Dogs welcome on the patio", "Beans sold by the half pound", "Busy 8–9 a.m. on weekends")],
        category: "Eat & Drink",
        address: addr("14 Creek Path"),
        website: "https://creekside.example",
        phone: "(303) 555-0112",
        hours: hours("06:30", "14:00", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        nextAction: { label: "Plan a walk to Mill Pond Park", path: "/places/mill-pond-park" },
      },
      image: { key: "creekside", title: "Creekside Coffee Roasters storefront", alt: "Illustrated storefront with a green awning and a sign reading Creekside Coffee Roasters", scene: { type: "storefront", sign: "Creekside Coffee", awning: "#2f5d3a", wall: "#e9dcc6", trim: "#5a3a22", seed: 11, detail: "coffee" } },
    },
    {
      externalId: "place-ridge-house",
      kind: "place",
      payload: {
        ...common({ title: "The Ridge House Tavern", slug: "ridge-house-tavern", summary: "Timber-frame tavern with a long porch, a short menu that changes weekly and live music most Saturdays.", lastVerifiedOn: verified(now, 20), sourceUrl: "https://ridgehouse.example", attribution: "Guide visit" }),
        body: [p("The Ridge House has been the town's living room since the mine closed. The porch faces west, so evenings are the draw: bring a layer, because the temperature drops fast once the sun goes behind Saddle Ridge."), p("Kitchen hours are shorter than bar hours. Reservations are only taken for groups of eight or more; everyone else waits on the porch with a drink."), h2("Good to know"), list("Music Saturdays from 7 p.m.", "Kids welcome until 8 p.m.", "Parking is on Aspen Street, not on the lane")],
        category: "Eat & Drink",
        address: addr("201 Ridge Lane"),
        website: "https://ridgehouse.example",
        phone: "(303) 555-0134",
        hours: { ...hours("16:00", "22:00", ["wed", "thu", "sun"]), fri: [{ open: "16:00", close: "23:30", closesNextDay: false }], sat: [{ open: "12:00", close: "23:30", closesNextDay: false }] },
        nextAction: { label: "See upcoming events", path: "/events" },
      },
      image: { key: "ridge-house", title: "The Ridge House Tavern at dusk", alt: "Illustrated timber tavern facade with a rust-colored awning under an evening sky", scene: { type: "storefront", sign: "Ridge House Tavern", awning: "#a4502b", wall: "#6b4a33", trim: "#2b1d14", seed: 23 } },
    },
    {
      externalId: "place-hollow-bakery",
      kind: "place",
      payload: {
        ...common({ title: "Hollow Bakery & Provisions", slug: "hollow-bakery-provisions", summary: "Sourdough, mountain pies and a small grocery shelf for the cabins up the valley. Sells out by noon on Saturdays.", lastVerifiedOn: verified(now, 4), attribution: "Guide visit" }),
        body: [p("The bakery shares a wall with the old assay office and keeps the original tin ceiling. Loaves come out at 7:30; the pie case fills by 9. If you are heading up-valley, the provisions shelf covers the basics: eggs, milk, coffee, batteries and the local honey."), p("Hours are unverified for the winter season. The owner said they may close Mondays after the first snow; call before making a special trip.")],
        category: "Eat & Drink",
        address: addr("88 Aspen Street"),
        website: "",
        phone: "(303) 555-0157",
        hours: null,
        nextAction: { label: "", path: "" },
      },
      image: { key: "bakery", title: "Hollow Bakery & Provisions", alt: "Illustrated bakery storefront with a cream awning and a loaf of bread sign", scene: { type: "storefront", sign: "Hollow Bakery", awning: "#d9b58e", wall: "#f3ede2", trim: "#8a5a2b", seed: 37, detail: "bread" } },
    },
    {
      externalId: "place-larkspur-loop",
      kind: "place",
      payload: {
        ...common({ title: "Larkspur Loop Trailhead", slug: "larkspur-loop-trailhead", summary: "Four-mile loop with 900 feet of gain, wildflowers in June and the best sunrise bench in the county.", lastVerifiedOn: verified(now, 12), sourceUrl: "https://pinehollowtrails.example/larkspur", attribution: "Pine Hollow Trails Association (fictional)" }),
        body: [p("Park at the gravel lot at the end of Miner's Road. The loop runs counter-clockwise by convention so that the steep section is a climb rather than a descent. Expect mud through mid-June and ice on the north side from November."), h2("Before you go"), list("No water at the trailhead", "Dogs on leash April–July for ground-nesting birds", "Cell coverage ends past the second switchback")],
        category: "Outdoors",
        address: { line1: "End of Miner's Road", line2: "", locality: "Pine Hollow", region: "CO", postalCode: "80999", approved: false },
        areaDescription: "Trailhead lot 1.5 miles north of town on Miner's Road",
        website: "https://pinehollowtrails.example/larkspur",
        phone: "",
        hours: null,
        nextAction: { label: "Volunteer trail day", path: "/events/larkspur-loop-volunteer-trail-day" },
      },
      image: { key: "larkspur", title: "Larkspur Loop at sunrise", alt: "Illustrated mountain ridgeline at dawn with pine trees in the foreground", scene: { type: "landscape", palette: "dawn", seed: 5 } },
    },
    {
      externalId: "place-mill-pond",
      kind: "place",
      payload: {
        ...common({ title: "Mill Pond Park", slug: "mill-pond-park", summary: "Town park around the old mill pond: a half-mile path, picnic tables, a swimming beach in July and skating when the ice is posted safe.", lastVerifiedOn: verified(now, 30), attribution: "Town of Pine Hollow parks notice (fictional)" }),
        body: [p("The pond was dug for the sawmill in the 1890s and has been the town's swimming hole for a century. The path is flat and stroller-friendly. The town posts an ice-safety sign at the boathouse in winter; if the sign is not out, stay off the ice."), list("Restrooms open May–October", "Picnic tables first come, first served", "No motorized boats")],
        category: "Outdoors",
        address: addr("1 Pond Road"),
        website: "",
        phone: "(303) 555-0100",
        hours: hours("06:00", "22:00", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        nextAction: { label: "Read about the pond cleanup", path: "/events/mill-pond-cleanup" },
      },
      image: { key: "mill-pond", title: "Mill Pond in late summer", alt: "Illustrated pond reflecting a blue sky with wooded hills behind it", scene: { type: "landscape", palette: "day", seed: 8, water: true } },
    },
    {
      externalId: "place-timber-falls",
      kind: "place",
      payload: {
        ...common({ title: "Timber Falls Overlook", slug: "timber-falls-overlook", summary: "Short paved walk to a railed overlook above a 60-foot waterfall. Loud in June, a ribbon by September, frozen and beautiful in January.", lastVerifiedOn: verified(now, 45), attribution: "Guide visit" }),
        body: [p("The overlook is a quarter mile from the pull-off on County Road 9 and is one of the few viewpoints in the valley that works for wheelchairs and strollers. The railing is new; the drop beyond it is not something to test."), p("Star parties use the overlook lot because it faces away from town lights. Bring a red flashlight if you join one.")],
        category: "Outdoors",
        address: { line1: "County Road 9, mile marker 4", line2: "", locality: "Pine Hollow", region: "CO", postalCode: "80999", approved: false },
        areaDescription: "Pull-off on County Road 9, four miles east of town",
        website: "",
        phone: "",
        hours: null,
        nextAction: { label: "Join the star party", path: "/events/star-party-at-timber-falls" },
      },
      image: { key: "timber-falls", title: "Timber Falls", alt: "Illustrated waterfall dropping between dark cliffs into a pool", scene: { type: "icon", icon: "falls", bg: "#25302a", fg: "#4f6f6a", accent: "#cfe4f5" } },
    },
    {
      externalId: "place-hollow-mercantile",
      kind: "place",
      payload: {
        ...common({ title: "Hollow Mercantile", slug: "hollow-mercantile", summary: "Hardware, wool socks, fishing licenses and the only key-cutting machine for thirty miles. Open since 1921.", lastVerifiedOn: verified(now, 7), sourceUrl: "https://hollowmercantile.example", attribution: "Owner interview" }),
        body: [p("If Pine Hollow has a town square, it is the Mercantile's front step. The store stocks what the valley actually needs: stove parts, snow shovels in October, seed potatoes in April, and a wall of wool. Fishing and hunting licenses are sold at the back counter."), list("Key cutting while you wait", "Propane exchange out back", "Closed Sundays")],
        category: "Shops & Services",
        address: addr("100 Aspen Street"),
        website: "https://hollowmercantile.example",
        phone: "(303) 555-0121",
        hours: hours("08:00", "18:00", ["mon", "tue", "wed", "thu", "fri", "sat"]),
        nextAction: { label: "", path: "" },
      },
      image: { key: "mercantile", title: "Hollow Mercantile storefront", alt: "Illustrated general store with a dark green awning and a hardware sign", scene: { type: "storefront", sign: "Hollow Mercantile", awning: "#24382f", wall: "#c9b79c", trim: "#3a2a1e", seed: 41, detail: "gear" } },
    },
    {
      externalId: "place-aspen-street-books",
      kind: "place",
      payload: {
        ...common({ title: "Aspen Street Books", slug: "aspen-street-books", summary: "New and used books in two small rooms, with a strong shelf of regional history and a resident cat who ignores everyone.", lastVerifiedOn: verified(now, 15), sourceUrl: "https://aspenstreetbooks.example", attribution: "Guide visit" }),
        body: [p("The front room is new titles and maps; the back room is used paperbacks priced by the inch. The owner runs the reading nights at the library and will special-order anything the distributor carries within a week."), list("Trade credit for used books", "Local trail maps and guides", "Reading nights: see events")],
        category: "Shops & Services",
        address: addr("112 Aspen Street"),
        website: "https://aspenstreetbooks.example",
        phone: "(303) 555-0143",
        hours: { ...hours("10:00", "18:00", ["tue", "wed", "thu", "fri", "sat"]), sun: [{ open: "12:00", close: "16:00", closesNextDay: false }] },
        nextAction: { label: "Autumn reading night", path: "/events/autumn-reading-night" },
      },
      image: { key: "books", title: "Aspen Street Books", alt: "Illustrated bookshop with a blue awning and a stack of books on the sign", scene: { type: "storefront", sign: "Aspen Street Books", awning: "#4f6f8a", wall: "#efe6d6", trim: "#2b3a4a", seed: 53, detail: "books" } },
    },
    {
      externalId: "place-foothill-bike",
      kind: "place",
      payload: {
        ...common({ title: "Foothill Bike Repair", slug: "foothill-bike-repair", summary: "One-mechanic shop behind the fire station. Same-day flats, tune-ups by appointment, loaner bikes for visitors.", lastVerifiedOn: verified(now, 3), attribution: "Owner interview" }),
        body: [p("Ask for Dee. The shop is a converted garage, so the door is usually open and the radio is usually on. Rentals are old but tuned, and the price includes a helmet and a map of the pond loop."), list("Flats fixed while you wait", "Rentals by the half day", "Cash or card")],
        category: "Shops & Services",
        address: addr("6 Station Alley"),
        website: "",
        phone: "(303) 555-0166",
        hours: hours("09:00", "17:00", ["mon", "wed", "fri", "sat"]),
        nextAction: { label: "", path: "" },
      },
      image: { key: "bike", title: "Foothill Bike Repair", alt: "Illustrated garage-style bike shop with a bicycle drawn beside the sign", scene: { type: "storefront", sign: "Foothill Bike Repair", awning: "#a4502b", wall: "#dcd5c8", trim: "#4a3a2a", seed: 61, detail: "bike" } },
    },
    {
      externalId: "place-public-library",
      kind: "place",
      payload: {
        ...common({ title: "Pine Hollow Public Library", slug: "pine-hollow-public-library", summary: "Small library with big windows, a free seed exchange, public computers and the warmest reading room in town.", lastVerifiedOn: verified(now, 2), sourceUrl: "https://library.pinehollow.example", attribution: "Library notice" }),
        body: [p("The library is a two-room stone building beside the school. Cards are free to anyone in the county. The reading room has a wood stove and is the unofficial warming hut on ski days."), list("Public computers and printing", "Seed exchange February–May", "Story time Wednesdays at 10")],
        category: "Arts & Community",
        address: addr("30 School Street"),
        website: "https://library.pinehollow.example",
        phone: "(303) 555-0177",
        hours: { ...hours("10:00", "18:00", ["mon", "tue", "wed", "thu", "fri"]), sat: [{ open: "10:00", close: "14:00", closesNextDay: false }] },
        nextAction: { label: "Autumn reading night", path: "/events/autumn-reading-night" },
      },
      image: { key: "library", title: "Pine Hollow Public Library", alt: "Illustrated stone library building with a row of book spines drawn beside the sign", scene: { type: "storefront", sign: "Public Library", awning: "#5e6b7a", wall: "#b8b0a4", trim: "#2f3e46", seed: 71, detail: "library" } },
    },
    {
      externalId: "place-depot-gallery",
      kind: "place",
      payload: {
        ...common({ title: "Old Depot Gallery", slug: "old-depot-gallery", summary: "Cooperative gallery in the former rail depot: paintings, weaving and photography by valley artists, with a new show every season.", lastVerifiedOn: verified(now, 60), sourceUrl: "https://olddepotgallery.example", attribution: "Gallery notice" }),
        body: [p("The depot lost its trains in 1958 and gained its artists in 1998. Members staff the desk, so the person selling you a print may well have made it. Openings are the best-attended events in town after the harvest market."), p("Winter hours are shorter and the gallery closes entirely during changeovers; check the events list before driving out.")],
        category: "Arts & Community",
        address: addr("2 Depot Square"),
        website: "https://olddepotgallery.example",
        phone: "(303) 555-0188",
        hours: hours("11:00", "17:00", ["thu", "fri", "sat", "sun"]),
        nextAction: { label: "Gallery events", path: "/events" },
      },
      image: { key: "gallery", title: "Old Depot Gallery", alt: "Illustrated brick depot building with a framed picture drawn beside the sign", scene: { type: "storefront", sign: "Old Depot Gallery", awning: "#8a2b16", wall: "#9c5a44", trim: "#3a1d14", seed: 83, detail: "gallery" } },
    },
    {
      externalId: "place-community-hall",
      kind: "place",
      payload: {
        ...common({ title: "Community Hall at Miner's Park", slug: "community-hall-miners-park", summary: "Town-owned hall for meetings, potlucks, the winter market and the occasional wedding. Rentals through the town office.", lastVerifiedOn: verified(now, 90), attribution: "Town of Pine Hollow (fictional)" }),
        body: [p("The hall holds 120 seated and has a kitchen, a stage and terrible acoustics that nobody has fixed in forty years. The town council meets here the first Tuesday of the month, and the meeting is open."), list("Rentals: call the town office", "Kitchen available with rental", "Accessible entrance on the park side")],
        category: "Arts & Community",
        address: addr("50 Park Street"),
        website: "",
        phone: "(303) 555-0100",
        hours: null,
        nextAction: { label: "Contact the guide about a booking", path: "/contact" },
      },
      image: { key: "hall", title: "Community Hall at Miner's Park", alt: "Illustrated white clapboard hall with a peaked roof beside a park", scene: { type: "storefront", sign: "Community Hall", awning: "#f7f4ec", wall: "#f2efe8", trim: "#4a5a6a", seed: 97, detail: "hall" } },
    },
  ];

  const events: FixtureItem[] = [
    {
      externalId: "event-harvest-market",
      kind: "event",
      payload: {
        ...common({ title: "Harvest Market on Aspen Street", slug: "harvest-market-on-aspen-street", summary: "Aspen Street closes to cars for the valley's growers, bakers and makers. Music from noon, cider all day." }),
        body: [p("Forty vendors line Aspen Street from the Mercantile to the bookshop. Come early for eggs and late for deals on squash. The street reopens to cars at 5 p.m."), list("Free entry", "Bring bags", "Parking at the school")],
        startsAt: localInstant(now, 12, 9, 0, TZ),
        endsAt: localInstant(now, 12, 16, 0, TZ),
        timeZone: TZ,
        venueItemId: null,
        venueText: "Aspen Street, between the Mercantile and Aspen Street Books",
        organizerName: "Pine Hollow Growers' Circle (fictional)",
        organizerUrl: "https://growers.pinehollow.example",
        status: "scheduled",
        eventUrl: "",
        admission: "Free",
      },
      image: { key: "harvest-market", title: "Harvest Market poster", alt: "Poster with the words Harvest Market on Aspen Street in bold type", scene: { type: "poster", title: "Harvest Market on Aspen Street", subtitle: "Growers, bakers and makers · music from noon", bg: "#f7f4ec", fg: "#2f5d3a", accent: "#a4502b", seed: 3 } },
    },
    {
      externalId: "event-trail-day",
      kind: "event",
      payload: {
        ...common({ title: "Larkspur Loop Volunteer Trail Day", slug: "larkspur-loop-volunteer-trail-day", summary: "Help rebuild the water bars on the steep section before the snow. Tools, gloves and lunch provided." }),
        body: [p("Meet at the trailhead lot. Work is on the upper switchbacks, so expect a mile of walking before the first shovel. Wear boots. Under-16s need an adult along.")],
        startsAt: localInstant(now, 20, 8, 30, TZ),
        endsAt: localInstant(now, 20, 13, 0, TZ),
        timeZone: TZ,
        venueItemId: "@place-larkspur-loop",
        venueText: "",
        organizerName: "Pine Hollow Trails Association (fictional)",
        organizerUrl: "https://pinehollowtrails.example",
        status: "scheduled",
        eventUrl: "https://pinehollowtrails.example/volunteer",
        admission: "Free; sign up at the trails association site",
      },
    },
    {
      externalId: "event-reading-night",
      kind: "event",
      payload: {
        ...common({ title: "Autumn Reading Night", slug: "autumn-reading-night", summary: "Four valley writers read new work in the library's reading room. Cider, cookies and the wood stove." }),
        body: [p("Doors open at 6:30. Readings start at 7 and run about an hour, followed by a book table run by Aspen Street Books.")],
        startsAt: localInstant(now, 33, 18, 30, TZ),
        endsAt: localInstant(now, 33, 20, 30, TZ),
        timeZone: TZ,
        venueItemId: "@place-public-library",
        venueText: "",
        organizerName: "Pine Hollow Public Library",
        organizerUrl: "https://library.pinehollow.example",
        status: "scheduled",
        eventUrl: "",
        admission: "Free",
      },
    },
    {
      externalId: "event-star-party",
      kind: "event",
      payload: {
        ...common({ title: "Star Party at Timber Falls", slug: "star-party-at-timber-falls", summary: "Telescopes on the overlook lot from dusk until well past midnight. Dress for winter even in September." }),
        body: [p("The county astronomy club sets up four telescopes at the overlook. Arrive before dark to park without headlights on the group, and bring a red flashlight. The event runs past midnight, so the listed end time is on the following calendar day.")],
        startsAt: localInstant(now, 26, 20, 30, TZ),
        endsAt: localInstant(now, 27, 0, 30, TZ),
        timeZone: TZ,
        venueItemId: "@place-timber-falls",
        venueText: "",
        organizerName: "Front Range Sky Club (fictional)",
        organizerUrl: "",
        status: "scheduled",
        eventUrl: "",
        admission: "Free",
      },
    },
    {
      externalId: "event-winter-light",
      kind: "event",
      payload: {
        ...common({ title: "Depot Gallery Opening: Winter Light", slug: "depot-gallery-opening-winter-light", summary: "Opening reception for the winter show. Cancelled this year while the depot roof is repaired." }),
        body: [p("The gallery cooperative cancelled the opening after the October storm damaged the depot roof. The show itself is postponed to spring; this listing stays visible so nobody drives out for it.")],
        startsAt: localInstant(now, 25, 17, 0, TZ),
        endsAt: localInstant(now, 25, 19, 30, TZ),
        timeZone: TZ,
        venueItemId: "@place-depot-gallery",
        venueText: "",
        organizerName: "Old Depot Gallery cooperative",
        organizerUrl: "https://olddepotgallery.example",
        status: "cancelled",
        eventUrl: "",
        admission: "Free",
      },
      image: { key: "winter-light", title: "Winter Light opening poster", alt: "Poster reading Winter Light in pale type on a dark blue background", scene: { type: "poster", title: "Winter Light", subtitle: "Old Depot Gallery · opening reception", bg: "#22322c", fg: "#f7f4ec", accent: "#cfe4f5", seed: 9 } },
    },
    {
      externalId: "event-summer-concert",
      kind: "event",
      payload: {
        ...common({ title: "Summer Concert on the Green", slug: "summer-concert-on-the-green", summary: "The last of the summer concert series at Miner's Park, with the valley's own brass band." }),
        body: [p("Bring a blanket. The band plays two sets with a break for the pie raffle, which funds next year's series.")],
        startsAt: localInstant(now, -40, 18, 0, TZ),
        endsAt: localInstant(now, -40, 20, 30, TZ),
        timeZone: TZ,
        venueItemId: "@place-community-hall",
        venueText: "",
        organizerName: "Friends of Miner's Park (fictional)",
        organizerUrl: "",
        status: "scheduled",
        eventUrl: "",
        admission: "Free; pie raffle tickets $2",
      },
      image: { key: "summer-concert", title: "Summer concert poster", alt: "Poster reading Summer Concert on the Green in green type on a warm background", scene: { type: "poster", title: "Summer Concert on the Green", subtitle: "Miner's Park · brass band · pie raffle", bg: "#f2e6cf", fg: "#2f5d3a", accent: "#e7a37a", seed: 14 } },
    },
    {
      externalId: "event-pond-cleanup",
      kind: "event",
      payload: {
        ...common({ title: "Mill Pond Cleanup", slug: "mill-pond-cleanup", summary: "Annual shoreline cleanup before the pond freezes. Waders provided for the brave." }),
        body: [p("Thirty-one volunteers pulled eleven bags of debris and one shopping cart from the pond. Thank you; the boathouse coffee was on the town.")],
        startsAt: localInstant(now, -15, 9, 0, TZ),
        endsAt: localInstant(now, -15, 12, 0, TZ),
        timeZone: TZ,
        venueItemId: "@place-mill-pond",
        venueText: "",
        organizerName: "Town of Pine Hollow Parks (fictional)",
        organizerUrl: "",
        status: "scheduled",
        eventUrl: "",
        admission: "Free",
      },
    },
  ];

  const articles: FixtureItem[] = [
    {
      externalId: "article-trailheads",
      kind: "article",
      payload: {
        ...common({ title: "How Pine Hollow keeps its trailheads open", slug: "how-pine-hollow-keeps-its-trailheads-open", summary: "Nobody owns the Larkspur Loop lot, which is exactly why it stays plowed. A short history of the valley's volunteer trail deal.", lastVerifiedOn: verified(now, 5) }),
        body: [p("The Larkspur Loop trailhead sits on a strip of county land that nobody wanted until everybody did. In 2004 the trails association agreed to plow it, the county agreed to grade it, and the Mercantile agreed to sell the maps. Twenty years later the arrangement still holds, mostly because nobody has written it down."), h2("Why it matters"), p("Trailheads close when they become a problem for one landowner. Spreading the work across three parties means no single bad winter ends access. It also means the volunteer trail days are not optional: the water bars on the upper switchbacks are the association's half of the bargain."), h2("How to help"), list("Join a trail day (see the events list)", "Buy the map at the Mercantile; proceeds fund tools", "Park inside the lot, not along Miner's Road")],
        authorName: "Pine Hollow Guide editors",
        publishedOn: dateKey(now, -6, TZ),
        updatedOn: "",
      },
      image: { key: "article-trailheads", title: "Miner's Road in autumn", alt: "Illustrated autumn hillside with warm-colored ridges and evergreens", scene: { type: "landscape", palette: "autumn", seed: 21 } },
    },
    {
      externalId: "article-creekside-morning",
      kind: "article",
      payload: {
        ...common({ title: "A morning at Creekside Coffee Roasters", slug: "a-morning-at-creekside-coffee-roasters", summary: "Six-thirty on a Tuesday: the roaster is running, the dog walkers are arguing about snow, and the bench is already full." }),
        body: [p("At 6:28 the light is still behind Saddle Ridge and the window is already open. The first order is a black coffee for a man who has ordered a black coffee every morning for eleven years. The second is a cortado for someone who moved here in June and is trying hard to become a regular."), p("By seven the roaster is loud enough to end conversation, which is the point: the bench outside becomes the place where the town's weather predictions are settled. By nine the rush is over and the owner starts bagging beans for the Mercantile shelf."), h2("If you go"), list("Arrive before 8 for the bench", "Ask what is roasting; it changes weekly", "The creek path starts behind the building")],
        authorName: "Pine Hollow Guide editors",
        publishedOn: dateKey(now, -19, TZ),
        updatedOn: dateKey(now, -8, TZ),
      },
      image: { key: "article-creekside", title: "Creek path at first light", alt: "Illustrated valley at dawn with a stream reflecting a pale orange sky", scene: { type: "landscape", palette: "dawn", seed: 33, water: true } },
    },
    {
      externalId: "article-elk",
      kind: "article",
      payload: {
        ...common({ title: "Where to watch the elk this fall", slug: "where-to-watch-the-elk-this-fall", summary: "The herd moves through the lower meadows from late September. Here is where to look, and how not to be the person who gets too close." }),
        body: [p("Every autumn the elk come down from the high country and spend a few weeks in the meadows below Timber Falls. The bugling starts at dusk and carries across the valley; the Ridge House porch is a fine place to hear it with a drink in hand."), h2("Where"), list("County Road 9 pull-offs between mile markers 2 and 5", "The Mill Pond boathouse at dawn", "The Larkspur Loop lower meadow, from the trail only"), h2("How"), p("Stay in or beside your car on the county road. Bulls in the rut are unpredictable and faster than you. Binoculars are better than closeness, and the guide has heard every excuse for the person who wanted the photo.")],
        authorName: "Pine Hollow Guide editors",
        publishedOn: dateKey(now, -33, TZ),
        updatedOn: "",
      },
      image: { key: "article-elk", title: "Lower meadows at dusk", alt: "Illustrated dusk sky over layered mountain ridges and a dark meadow", scene: { type: "landscape", palette: "dusk", seed: 44, ratio: "wide" } },
    },
  ];

  const pages: FixtureItem[] = [
    {
      externalId: "page-home",
      kind: "page",
      payload: page({
        title: "Home",
        slug: "home",
        summary: "A resident-written guide to Pine Hollow, Colorado: places worth the drive, events worth the evening, and the small facts that make a visit go well.",
        metaDescription: "A resident-written guide to Pine Hollow, Colorado (fictional): places, events and short articles.",
        sections: [
          { id: "s-hero", type: "image_hero", heading: "Pine Hollow, at walking pace", subheading: "A small mountain town, written up by the people who live in it. Verified details, no sponsored listings, and an honest note when the hours are unknown.", imageAssetId: "@hero" as unknown as null, ctaLabel: "Browse the directory", ctaPath: "/places" },
          { id: "s-cats", type: "feature_list", heading: "Browse by category", items: [
            { title: "Eat & Drink", text: "Coffee at dawn, pie by nine, music on the porch.", path: "/places?category=Eat%20%26%20Drink" },
            { title: "Outdoors", text: "Trails, the pond and the falls, with the caveats that matter.", path: "/places?category=Outdoors" },
            { title: "Shops & Services", text: "The Mercantile, the bookshop and the one bike mechanic.", path: "/places?category=Shops%20%26%20Services" },
            { title: "Arts & Community", text: "Library, gallery and the hall with the terrible acoustics.", path: "/places?category=Arts%20%26%20Community" },
          ] },
          { id: "s-events", type: "content_collection", heading: "Upcoming events", kind: "event", mode: "upcoming", itemIds: [], limit: 4 },
          { id: "s-places", type: "content_collection", heading: "Selected places", kind: "place", mode: "selected", itemIds: ["@place-creekside-coffee", "@place-larkspur-loop", "@place-hollow-mercantile", "@place-public-library", "@place-ridge-house", "@place-mill-pond"] as unknown as string[], limit: 6 },
          { id: "s-feature", type: "content_collection", heading: "From the guide", kind: "article", mode: "latest", itemIds: [], limit: 3 },
          { id: "s-facts", type: "facts", heading: "Pine Hollow at a glance", variant: "grid", columns: 4, items: [
            { label: "Elevation", value: "8,240 ft" },
            { label: "Founded", value: "1881 (fictional)" },
            { label: "Year-round residents", value: "About 2,300" },
            { label: "From Denver", value: "90 minutes by car" },
          ] },
          { id: "s-voices", type: "quotes", heading: "From people who live here", variant: "grid", appearance: { background: "tint" }, items: [
            { text: "The guide is the only place that tells you the Mercantile closes at noon on Wednesdays. Everything else online is a guess.", attribution: "Marta Ellison", role: "Runs the roaster on Creek Path (fictional)" },
            { text: "When the trail day got rained out, the listing said so within the hour. That is why people trust it.", attribution: "Dev Okafor", role: "Larkspur Loop volunteer crew (fictional)" },
          ] },
          { id: "s-contact", type: "cta_banner", heading: "Know a place we should list?", text: "The guide is written by residents and updated when someone checks the facts. Tell us what changed or what is missing.", ctaLabel: "Tell the editors", ctaPath: "/contact", appearance: { background: "primary", align: "center" } },
        ],
      }),
    },
    {
      externalId: "page-about",
      kind: "page",
      payload: page({
        title: "About the guide",
        slug: "about",
        summary: "Who writes the Pine Hollow Guide, how listings are verified, and what this demonstration is and is not.",
        sections: [
          { id: "s-about", type: "rich_text", heading: "About the Pine Hollow Guide", body: [
            p("Pine Hollow is a fictional mountain town, and this guide is a demonstration of a community-guide website. Every place, event, person and phone number on these pages was invented for the demonstration; none of it describes a real business in Colorado or anywhere else."),
            h2("How a real guide would work"),
            p("Listings carry a verification date and a source. When a detail is unknown, the page says so rather than guessing: hours are never inferred from a category, and a cancelled event stays visible so nobody drives out for it."),
            list("Places are checked in person or with the owner", "Events come from organizers and are marked cancelled rather than removed", "Articles are short, signed and dated"),
            h2("Contact"),
            p("Corrections and suggestions go through the contact page. Messages are stored with a receipt reference and answered by the editors."),
          ] },
          { id: "s-faq", type: "faq", heading: "Visiting Pine Hollow", items: [
            { question: "When is the best time to visit?", answer: [p("Late June to early October for the trails and the pond; the **Harvest Market** in October is the busiest weekend of the year. Winter visits are quiet, and several places keep shorter hours, which the listings show per day.")] },
            { question: "Is there mobile coverage in the valley?", answer: [p("In town, yes. It fades past the Mill Pond dam and is gone at Timber Falls, so download directions before you leave the Mercantile.")] },
            { question: "Can I bring a dog to the trailheads?", answer: [p("On a leash at Larkspur Loop and Mill Pond Park. Timber Falls Overlook asks visitors to leave dogs in town because of the drop-offs near the viewpoint.")] },
          ] },
          { id: "s-gallery", type: "gallery", heading: "The valley through the year", variant: "grid", columns: 3, aspect: "landscape", items: [
            { assetId: "@hero" as unknown as string, caption: "The valley from Saddle Ridge at midday" },
            { assetId: "@larkspur" as unknown as string, caption: "Larkspur Loop above the tree line" },
            { assetId: "@timber-falls" as unknown as string, caption: "Timber Falls after the spring melt" },
            { assetId: "@mill-pond" as unknown as string, caption: "Mill Pond Park on a still morning" },
            { assetId: "@creekside" as unknown as string, caption: "Creekside Coffee Roasters on Creek Path" },
            { assetId: "@hall" as unknown as string, caption: "The community hall, acoustics and all" },
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
        summary: "Send a correction, suggest a place, or ask about an event. Messages get a receipt reference.",
        sections: [
          { id: "s-callout", type: "contact_callout", heading: "Get in touch", text: "Corrections, new places and event listings all start here. Include a way to reach you if we have questions.", showContactDetails: true },
          { id: "s-form", type: "inquiry_form", heading: "Send a message", intro: "Tell us what you noticed. If it concerns a specific place, choose it below.", locationSelect: true },
        ],
      }),
    },
  ];

  // Demonstration drafts: one unapproved draft item and one pending review.
  const draft: FixtureItem = {
    externalId: "place-saddleback-outfitters",
    kind: "place",
    leaveAsDraft: true,
    payload: {
      ...common({ title: "Saddleback Outfitters", slug: "saddleback-outfitters", summary: "Guided horseback rides into the upper valley from June to September. Listing in progress; hours and prices not yet verified." }),
      body: [p("Draft listing. The editors have not yet visited or confirmed the details with the owner.")],
      category: "Outdoors",
      address: addr("Saddle Ridge Road"),
      website: "",
      phone: "",
      hours: null,
      nextAction: { label: "", path: "" },
    },
  };
  const pendingReview: FixtureItem = {
    externalId: "article-winter-parking",
    kind: "article",
    submitForReview: true,
    payload: {
      ...common({ title: "Winter parking rules, explained", slug: "winter-parking-rules-explained", summary: "Aspen Street becomes a snow route on December 1. Here is what that means for visitors." }),
      body: [p("From December 1 the town plows Aspen Street between 2 and 6 a.m., and cars left on the street overnight are towed to the school lot. Visitors staying in town should use the lot behind the Mercantile.")],
      authorName: "Pine Hollow Guide editors",
      publishedOn: dateKey(now, 0, TZ),
      updatedOn: "",
    },
  };

  return {
    key: "pine-hollow",
    config: {
      tagline: "A resident-written guide to a fictional mountain town",
      footerText: "Pine Hollow is fictional. This guide demonstrates a community website: verified listings, honest unknowns, and events that stay visible when cancelled.",
      defaultDescription: "A resident-written guide to Pine Hollow, Colorado (fictional): places, events and short articles.",
      heroImageKey: "hero",
      logoImageKey: "logo",
      shareImageKey: "hero",
    },
    images: [{ key: "logo", title: "Pine Hollow Guide logo", alt: "Pine Hollow Guide", scene: { type: "logo", lines: ["Pine Hollow", "GUIDE"], fg: "#2f5d3a", accent: "#a4502b", emblem: "pine" } }],
    items: [...pages, ...places, ...events, ...articles, draft, pendingReview],
    secondRelease: {
      note: "Ridge House extends Friday hours for the harvest season",
      apply: (items) => items.map((it) => (it.externalId === "place-ridge-house" ? { ...it, payload: { ...it.payload, hours: { ...(it.payload.hours as Record<string, unknown>), fri: [{ open: "16:00", close: "00:30", closesNextDay: true }] }, lastVerifiedOn: dateKey(now, 0, TZ) } } : it)),
    },
    inquiry: { name: "Demo visitor (fixture)", email: "visitor@fixture.example", message: "[Demo fixture] The bakery's Monday hours look out of date; they were closed when I visited last week.", sourcePath: "/contact" },
  };
}

export const pineHollowHero = { key: "hero", title: "Pine Hollow valley from Saddle Ridge", alt: "Illustrated mountain valley at midday with a river and pine forest", scene: { type: "landscape" as const, palette: "day" as const, seed: 1, water: true, ratio: "standard" as const }, focal: { x: 0.5, y: 0.42 } };
