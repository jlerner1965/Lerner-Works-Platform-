import type { ProofPhoto, ProofSite } from "./types";

/**
 * Bookcliff Farm Markets: the location business proof site (site-building programme B4). A
 * fictional family of three farm markets in Colorado's Grand Valley (Palisade, Orchard Mesa
 * and a seasonal stand in Fruita), written as the client would fill in the onboarding
 * package: the markets with their hours, the services, the brand and the starter pages'
 * text. The photographs are Carol M. Highsmith's of orchards, produce stands and markets,
 * public domain through the Library of Congress; the business, its people, addresses and
 * phone numbers are invented, and no photograph shows a business named here.
 */

const week = (open: string, close: string, except: Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>> = {}): Record<string, string> => {
  const hours: Record<string, string> = {};
  for (const d of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) hours[`hours_${d}`] = except[d] ?? `${open}-${close}`;
  return hours;
};

const photo = (file: string, loc: string, item: string, locTitle: string, title: string, alt: string): ProofPhoto => ({ file, loc, sourceUrl: `https://www.loc.gov/item/${item}/`, locTitle, title, alt });

const photos: ProofPhoto[] = [
  photo("orchards-mesa.jpg", "48800:48898", "2017885528", "Orchards below Mount Garfield in the agricultural town of Palisade, in Colorado's \"Grand Valley\" outside Grand Junction", "Orchards below the Book Cliffs", "Rows of orchard trees on the valley floor below a pale, flat-topped mesa under a blue sky"),
  photo("peach-trees.jpg", "33500:33518", "2015633533", "Young peach trees in the orchard-filled town of Palisade, outside Grand Junction, Colorado. In the distance is the area's famous Grand Mesa, which, at 40 miles in length, is reputed to be the world's largest mesa, an elevated, flat-topped area of land", "Young peach trees", "Rows of young peach trees staked in a green orchard, a mesa on the horizon"),
  photo("fruit-trucks.jpg", "48700:48711", "2017885341", "Old trucks, used to haul fruit from nearby orchards in Grand Junction, Colorado. The vehicles are displayed at the Museum of Western Colorado's Cross Orchards Historic Site", "The old fruit trucks", "A line of rusted 1930s trucks once used to haul fruit, parked in a gravel yard"),
  photo("palisade-market.jpg", "48200:48251", "2017884882", "Farm market all decked out for fall in Moultonborough, New Hampshire", "Palisade Market", "A timber farm market building with an open front, pumpkins and flowers stacked outside under a big tree"),
  photo("orchard-mesa-market.jpg", "44600:44645", "2017881460", "A fully stocked produce stand in Grandy, North Carolina", "Orchard Mesa Market", "A blue-painted produce stand with baskets of vegetables and fruit lined up along its open front"),
  photo("fruita-stand.jpg", "33600:33675", "2015633691", "A farmers' produce stand, specializing in seasonal fruit, jellies, and jams, in Silverthorne, Colorado", "The Fruita stand", "A small red roadside stand with a round Farm Stand sign, a Peaches board and barrels of flowers out front"),
  photo("market-aisle.jpg", "41100:41142", "2016631960", "A colorful array of produce options at the South Bend Farmers' Market in South Bend, Indiana", "Inside the market", "A long market aisle with crates of apples, peppers and squash under a high roof"),
  photo("sweet-corn.jpg", "41100:41141", "2016631959", "The arrival of autumn is evident in the array of foods and decorations offered for sale at the South Bend Farmers' Market in South Bend, Indiana", "Sweet corn and squash", "A market stall stacked with squash and pumpkins under a hand-lettered Sweet Corn sign"),
  photo("produce-display.jpg", "41100:41143", "2016631961", "The arrival of autumn is evident in the array of foods and decorations from which customers can choose at the South Bend Farmers' Market in South Bend, Indiana", "The autumn display", "Bins of squash, apples and peppers along a market counter, a shopper choosing at the far end"),
  photo("tomatoes.jpg", "45500:45594", "2017882343", "Jersey tomatoes at The Corn Stop Farmer's Market in Mount Holly, New Jersey", "Tomatoes by the basket", "Tiers of red tomatoes in white baskets stacked on a market table"),
  photo("apple-orchard.jpg", "45900:45995", "2017882743", "Scene at fall apple-harvest time at Shelburne Orchards in Shelburne, Vermont", "The orchard at picking time", "Apple trees heavy with red fruit in an orchard row at harvest time"),
  photo("apples-trailer.jpg", "45800:45864", "2017882612", "Roadside trailer offering bags of apples for sale near Brunswick, Maine", "Apples by the bag", "A small red trailer at the roadside loaded with bags of apples under two Apples signs"),
  photo("hayride.jpg", "41500:41525", "2016632343", "A horse-drawn wagon carries visitors into the pumpkin patch each autumn at Hershberger's Farm and Bakery, a greatly expanded produce stand near the town of Berlin in central Ohio's \"Amish Country\"", "The hayride", "Two draft horses pulling a covered wagon of visitors towards a pumpkin patch"),
  photo("pumpkin-patch.jpg", "48600:48693", "2017885323", "Pumpkin patch in Vineland, Colorado, near Pueblo", "The pumpkin patch", "Orange pumpkins scattered across a green field under a dramatic cloudy sky"),
  photo("barn-pumpkins.jpg", "46100:46169", "2017882917", "Pumpkins by the dozens, harvested from the fields behind this barn in Richmond, Vermont", "Pumpkins at the barn", "Dozens of pumpkins spread on the grass in front of a red barn and a tractor"),
  photo("dried-corn.jpg", "41500:41517", "2016632335", "Decorative ears of dried corn at Hershberger's Farm and Bakery, a greatly expanded produce stand near the town of Berlin in central Ohio's \"Amish Country\"", "Dried corn", "Ears of dried decorative corn in reds, yellows and blues hanging in a row"),
  photo("fields-sunset.jpg", "33900:33901", "2015633917", "Crops at sunset near Longmont in Colorado's \"Front Range\" of the Rocky Mountains", "The fields at sunset", "Sun breaking through dark clouds over a green field, mountains along the horizon"),
  photo("river-bluff.jpg", "35100:35141", "2017685624", "Bluff above the Colorado River near Palisade in Mesa County, Colorado", "The river below the bluff", "A wide river under a pale bluff, cottonwoods along the far bank"),
  photo("pumpkin-truck.jpg", "46700:46761", "2017883483", "Flatbed truck loaded with pumpkins for sale in the early fall season at Harvest Farm in Valle Crucis, North Carolina", "The pumpkin truck", "An old green flatbed truck piled with pumpkins beside a weathered barn"),
  photo("stand-counter.jpg", "45700:45703", "2017882451", "A view inside The Farm flower and vegetable stand in Cape Elizabeth, Maine", "The order counter", "The counter inside a farm stand with a scale, paper bags and cut flowers in the window"),
  photo("apple-trees.jpg", "40600:40677", "2016631495", "Apple trees such as these in the orchards above Gays Mills, Wisconsin, which range over a thousand acres, are not the sort one sits under as in the old song, \"Don't Sit Under the Apple Tree\"", "Apple trees on the trellis", "Rows of trellised apple trees loaded with red fruit under a blue sky"),
];

const GV = { region: "CO", time_zone: "America/Denver", status: "open" };

export const bookcliff: ProofSite = {
  key: "bookcliff",
  name: "Bookcliff Farm Markets",
  preset: "location_business",
  timeZone: "America/Denver",
  contactEmail: "hello@bookclifffarms.example",
  settings: {
    wordmark: "Bookcliff Farm Markets",
    tagline: "Fruit and vegetables from the Grand Valley, picked this week",
    description: "Three farm markets in Colorado's Grand Valley: peaches, apples and vegetables from our own orchards and the valley's growers, harvest boxes, wholesale and autumn weekends on the farm.",
    contact_email: "hello@bookclifffarms.example",
    contact_phone: "(970) 555-0160",
    contact_address: "3720 Orchard Road\\nPalisade, CO 81526",
    primary_color: "#6b3a2a",
    accent_color: "#8f5312",
    background_color: "#fbf7f0",
    text_color: "#2b2622",
    typography: "friendly-rounded",
    logo: "logo.png",
    share_image: "orchards-mesa.jpg",
    hero_image: "orchards-mesa.jpg",
    home_subheading: "Peaches in July, apples in September and vegetables all season from our orchards below the Book Cliffs and the valley's growers. Three markets, one family, since 1978.",
    home_intro: "Bookcliff Farm Markets started as a peach stand on Orchard Road in 1978 and has grown into three markets: the farm in Palisade, the Orchard Mesa market in Grand Junction and the summer stand on the highway in Fruita.\n\nEverything on the tables was picked within the week, most of it within the day. What we do not grow ourselves comes from growers within twenty miles, and the label says whose it is.",
    about_text: "## The farm\n\nForty acres of peaches, apples and cherries on Orchard Road, planted by the Hollis family in 1978 and still worked by them. The packing shed behind the Palisade market is where the harvest boxes are filled every Tuesday and Friday.\n\n## What we sell\n\n- Our own peaches, apples, cherries and pears in season.\n- Vegetables from the farm and from growers within twenty miles of it, each labelled with the grower's name.\n- Eggs, honey, jams and cider from the valley.\n\n## How to reach us\n\nEach market has its own phone number and hours on its page. For orders, wholesale and the harvest boxes, use the inquiry form and say which market you would like to collect from.",
  },
  artwork: [
    { file: "logo.png", title: "Bookcliff Farm Markets logo", alt: "Bookcliff Farm Markets", scene: { type: "logo", lines: ["Bookcliff", "FARM MARKETS"], fg: "#6b3a2a", accent: "#8f5312", emblem: "sun" } },
    { file: "portrait-marisol.png", title: "Marisol Vega", alt: "Stylised portrait of Marisol Vega, the markets' fictional manager", scene: { type: "portrait", initials: "MV", bg: "#f1e4d2", fg: "#6b3a2a", accent: "#8f5312", seed: 31 } },
    { file: "portrait-grant.png", title: "Grant Hollis", alt: "Stylised portrait of Grant Hollis, the farm's fictional orchardist", scene: { type: "portrait", initials: "GH", bg: "#e6e0d4", fg: "#2b2622", accent: "#6b3a2a", seed: 32 } },
    { file: "portrait-ana.png", title: "Ana Petrov", alt: "Stylised portrait of Ana Petrov, who runs the fictional harvest boxes", scene: { type: "portrait", initials: "AP", bg: "#f5e9d5", fg: "#6b3a2a", accent: "#8f5312", seed: 33 } },
    { file: "portrait-lena.png", title: "Lena Ruiz", alt: "Stylised portrait of Lena Ruiz, a fictional restaurant owner", scene: { type: "portrait", initials: "LR", bg: "#e9e4dc", fg: "#2b2622", accent: "#8f5312", seed: 34 } },
    { file: "portrait-tom.png", title: "Tom Averill", alt: "Stylised portrait of Tom Averill, a fictional harvest box subscriber", scene: { type: "portrait", initials: "TA", bg: "#f0e6d8", fg: "#6b3a2a", accent: "#2b2622", seed: 35 } },
    { file: "mark-growers.png", title: "Grand Valley Growers Cooperative mark", alt: "Grand Valley Growers Cooperative", scene: { type: "logo", lines: ["Grand Valley", "GROWERS CO-OP"], fg: "#6b3a2a", accent: "#8f5312", emblem: "leaf" } },
    { file: "mark-orchard-trail.png", title: "Orchard Trail Partners mark", alt: "Orchard Trail Partners", scene: { type: "logo", lines: ["Orchard Trail", "PARTNERS"], fg: "#2b2622", accent: "#6b3a2a", emblem: "sun" } },
    { file: "mark-chamber.png", title: "River District Chamber mark", alt: "River District Chamber of Commerce", scene: { type: "logo", lines: ["River District", "CHAMBER"], fg: "#6b3a2a", accent: "#8f5312", emblem: "ring" } },
  ],
  photos,
  rows: {
    service: [
      { external_id: "S-01", title: "Harvest boxes", slug: "harvest-boxes", summary: "A box of the week's fruit and vegetables, packed on Tuesday and Friday, collected from any market or delivered in Palisade and Grand Junction.", inquiry_prompt: "Ask about a harvest box subscription and where you would like to collect it.", body: "The harvest box is what the farm and the valley's growers have that week: in July it is peaches and the first tomatoes, in September apples, corn and squash, in November storage vegetables and cider. A small box feeds two people for a week; the large box feeds four.\n\n## How it works\n\n- Boxes are packed on Tuesday and Friday mornings from that morning's picking.\n- Collect from any of the three markets, or have it delivered within Palisade and Grand Junction for four dollars.\n- Pause or cancel any week by the Sunday before.\n\nSubscriptions run from May to November. Ask at a market or use the inquiry form and say where you would like to collect.", image: "produce-display.jpg" },
      { external_id: "S-02", title: "Wholesale for restaurants and grocers", slug: "wholesale", summary: "Weekly deliveries of fruit and vegetables to restaurants and grocers across the valley, with a price list every Monday.", inquiry_prompt: "Ask for this week's wholesale list.", body: "We deliver to about forty restaurants, grocers and school kitchens between Fruita and Grand Junction. The price list goes out on Monday morning by email, orders are in by Tuesday evening, and the truck runs on Wednesday and Saturday.\n\nMinimum order is fifty dollars. Case quantities are packed at the farm the morning they go out; anything from another grower is labelled with the grower's name, as it is on the market tables.", image: "tomatoes.jpg" },
      { external_id: "S-03", title: "Orders for holidays and events", slug: "orders", summary: "Fruit baskets, catering trays and bulk orders for the holidays, weddings and company events, ready for collection at any market.", inquiry_prompt: "Tell us the date, the number of people and which market you would like to collect from.", body: "Fruit baskets and gift boxes are made up at the Palisade market from whatever is best that week, and can be sent within the valley or collected. For events we prepare fruit and vegetable trays, bulk fruit by the case and, in autumn, pumpkins and decorative corn by the truckload.\n\nOrders need three days' notice; holiday orders for Thanksgiving and Christmas close a week before. Use the inquiry form and say the date, the number of people and where you would like to collect.", image: "stand-counter.jpg" },
      { external_id: "S-04", title: "Pick your own and orchard tours", slug: "u-pick", summary: "Pick your own peaches in July and August and apples in September and October at the Palisade farm, with a walk through the orchard on Saturday mornings.", inquiry_prompt: "Ask about group visits and school tours.", body: "Picking runs on weekend mornings from eight until noon while the fruit lasts: peaches from mid July, apples from mid September. Bags and ladders are at the shed; fruit is weighed on the way out.\n\nThe Saturday orchard walk at nine takes about an hour and follows the year in the orchard, from pruning to packing. Groups of more than twelve and school visits are by arrangement.", image: "apple-orchard.jpg" },
      { external_id: "S-05", title: "Autumn weekends on the farm", slug: "autumn-weekends", summary: "Pumpkin patch, hayrides and the cider press at the Palisade farm on weekends from late September to the end of October.", inquiry_prompt: "Ask about bringing a group or a school class.", body: "From the last weekend of September until Halloween the farm opens its pumpkin patch on Saturdays and Sundays: pick your own pumpkin from the field, ride the wagon out and back, and watch the cider press run at eleven and two. Admission is free; pumpkins are sold by weight.\n\nThe farm is at 3720 Orchard Road; parking is in the orchard lane. Dogs on leads are welcome in the patch but not on the wagon.", image: "hayride.jpg" },
    ],
    store: [
      { external_id: "ST-01", title: "Palisade Market", slug: "palisade", summary: "The farm market on Orchard Road: our own fruit from the orchard behind it, the packing shed, the harvest boxes and the autumn weekends.", address_line1: "3720 Orchard Road", locality: "Palisade", postal_code: "81526", phone: "(970) 555-0161", ...GV, ...week("08:00", "18:00", { sun: "09:00-16:00" }), services: "harvest-boxes;wholesale;orders;u-pick;autumn-weekends", body: "The Palisade market is the farm. The orchard starts behind the packing shed, the fruit on the tables was picked that morning, and the harvest boxes are filled here on Tuesday and Friday.\n\nThe market is open all year; the u-pick, the orchard walks and the autumn weekends are on their own pages. Parking is in the orchard lane; the lot fills by ten on autumn weekends.", image: "palisade-market.jpg" },
      { external_id: "ST-02", title: "Orchard Mesa Market", slug: "orchard-mesa", summary: "The everyday market in Grand Junction: the farm's fruit, the valley's vegetables, eggs, honey and cider, open seven days until seven.", address_line1: "2895 Orchard Mesa Drive", locality: "Grand Junction", postal_code: "81503", phone: "(970) 555-0162", ...GV, ...week("08:00", "19:00"), services: "harvest-boxes;wholesale;orders", body: "The Orchard Mesa market is where most of Grand Junction shops with us: the same fruit as the farm, delivered every morning, and the widest choice of the valley's vegetables, eggs, honey and cider. Harvest boxes can be collected here from noon on packing days.\n\nThe wholesale truck leaves from here on Wednesday and Saturday; restaurant customers can collect from the loading door at the back before eight.", image: "orchard-mesa-market.jpg" },
      { external_id: "ST-03", title: "Fruita Stand", slug: "fruita", summary: "The summer stand on the highway: peaches, sweet corn, tomatoes and melons from May to October, Thursday to Sunday.", address_line1: "1310 Highway 6", locality: "Fruita", postal_code: "81521", phone: "(970) 555-0163", ...GV, ...week("10:00", "17:00", { mon: "closed", tue: "closed", wed: "closed" }), services: "harvest-boxes", body: "The Fruita stand is the original kind of Bookcliff market: a roadside stand with the day's fruit and vegetables, open from the first strawberries in May until the last of the apples in October. Cash and cards.\n\nHarvest boxes can be collected here on Fridays. The stand closes for the winter after the last weekend of October and reopens in May; the date is posted here.", image: "fruita-stand.jpg" },
    ],
  },
};
