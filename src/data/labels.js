// labels.js: friendly names for every item id, shown on chips and cards.
export const ITEM_LABELS = {
  walk: 'Walk', cycle: 'Cycle', metro: 'Metro', train: 'Train', bus: 'Bus', bike: 'Bike',
  carpool: 'Carpool', auto: 'Auto', car: 'Car', flight: 'Flight',
  led_light: 'LED light', laptop: 'Laptop', fan: 'Fan', ac: 'AC', electricity_kwh: 'Electricity (bill units)', geyser: 'Geyser',
  dal_rice: 'Dal rice', veg_thali: 'Veg thali', egg_meal: 'Egg meal', paneer_meal: 'Paneer meal',
  chicken_meal: 'Chicken meal', mutton_meal: 'Mutton meal', beef_meal: 'Beef meal',
  online_order: 'Online order', clothing_secondhand: 'Second-hand clothes',
  clothing_new: 'New clothes', phone_new: 'New phone',
  plastic_bag: 'Plastic bag', plastic_bottle: 'Plastic bottle', food_waste_100g: 'Food waste',
  cold_shower: 'Cold shower', hot_shower: 'Hot shower', machine_wash: 'Machine wash',
  video_call: 'Video call', streaming: 'Streaming', gaming: 'Gaming',
  e_rickshaw: 'E-rickshaw', ev_scooter: 'Electric scooter', ev_car: 'Electric car', shared_auto: 'Shared auto',
  tv: 'TV', desktop_pc: 'Desktop PC', iron: 'Iron (clothes)', room_heater: 'Room heater',
  tea_coffee: 'Tea or coffee', instant_noodles: 'Instant noodles', street_food: 'Street food',
  veg_burger: 'Burger', pizza: 'Pizza', fish_meal: 'Fish meal',
  book: 'Book', gadget_small: 'Small gadget', shoes_new: 'New shoes',
  paper_cup: 'Paper cup', takeaway_container: 'Takeaway box',
  bucket_bath: 'Bucket bath', music_streaming: 'Music', social_media: 'Social media',
  own_cup: 'Own cup',
  tree: 'Plant a tree', compost: 'Compost', own_bottle: 'Own bottle', own_bag: 'Own bag',
};

export function itemLabel(item) {
  return ITEM_LABELS[item] ?? item;
}
