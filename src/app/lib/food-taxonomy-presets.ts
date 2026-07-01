export type ExternalBulkPresetGroup = {
  parentSlug: string;
  labels: string[];
};

export const EXTRA_BULK_PRESET_GROUPS: ExternalBulkPresetGroup[] = [
  {
    parentSlug: 'cheese',
    labels: [
      'Baby Swiss', 'Jarlsberg', 'Edam', 'Leerdammer', 'Tilsit', 'Appenzeller', 'Beaufort', 'Morbier', 'Reblochon', 'Epoisses',
      'Saint Andre', 'Saint Nectaire', 'Boursin', 'Port Salut', 'Cantal', 'Mimolette', 'Tomme', 'Chaource', 'Cambozola', 'Crescenza',
      'Scamorza', 'Caciocavallo', 'Bocconcini', 'Ciliegine Mozzarella', 'String Cheese', 'Cheese Curd', 'Curd Snack', 'Beer Cheese',
      'Pimento Cheese', 'Pub Cheese', 'Cold Pack Cheese', 'American Cheese', 'Deli Cheese Slice', 'Smoked Cheddar', 'Smoked Mozzarella',
      'Lactose Free Cheese', 'Goat Brie', 'Sheep Milk Cheese', 'Buffalo Mozzarella', 'Whipped Feta', 'Labneh Cheese', 'Kashkaval',
      'Mizithra', 'Halloumi Fries', 'Paneer Cube', 'Paneer Tikka', 'Tofu Cheese Alternative', 'Pea Protein Cheese', 'Sunflower Cheese',
      'Potato Starch Cheese', 'Plant Based Cheese Slice', 'Plant Based Cheese Shred', 'Plant Based Cheese Sauce',
    ],
  },
  {
    parentSlug: 'bread',
    labels: [
      'Country Loaf', 'Pain De Campagne', 'Pain Au Levain', 'Boule', 'Batard', 'Miche', 'Pullman Loaf', 'Texas Toast', 'Toast Bread',
      'Cinnamon Raisin Bread', 'Fruit Bread', 'Walnut Bread', 'Olive Bread', 'Cheese Bread', 'Jalapeno Bread', 'Beer Bread',
      'Sprouted Grain Bread', 'Protein Bread', 'Keto Bread', 'Low Carb Bread', 'Ancient Grain Bread', 'Oat Bread', 'Spelt Bread',
      'Buckwheat Bread', 'Teff Injera', 'Sangak', 'Barbari Bread', 'Matzo', 'Lefse', 'Yufka', 'Piadina', 'Tandoori Naan',
      'Garlic Naan', 'Kulcha', 'Poori', 'Bhatura', 'Dosa', 'Idli', 'Appam', 'Johnnycake', 'Hushpuppy', 'Bannock',
      'Damper Bread', 'Pan Dulce', 'Concha', 'Bolillo', 'Telera Roll', 'Medianoche Bread', 'Cuban Bread', 'Portuguese Roll',
      'Kouign Amann', 'Palmier', 'Puff Pastry', 'Phyllo Pastry', 'Vol Au Vent', 'Sausage Roll Pastry',
    ],
  },
  {
    parentSlug: 'meat',
    labels: [
      'Chuck Roast', 'Top Round', 'Bottom Round', 'Flank Steak', 'Skirt Steak', 'Hanger Steak', 'Tri Tip', 'Prime Rib', 'Beef Shank',
      'Oxtail', 'Beef Cheek', 'Beef Tongue', 'Beef Liver', 'Beef Heart', 'Carne Asada', 'Barbacoa', 'Birria Meat', 'Italian Beef',
      'Philly Cheesesteak Meat', 'Pork Rib', 'Baby Back Rib', 'Spare Rib', 'Pork Loin', 'Pork Cutlet', 'Pork Schnitzel',
      'Pork Chop', 'Carnitas', 'Al Pastor Meat', 'Pork Rind Meat', 'Country Ham', 'Canadian Bacon', 'Chicken Cutlet',
      'Chicken Schnitzel', 'Chicken Kebab', 'Chicken Shawarma', 'Chicken Gyro Meat', 'Chicken Meatball', 'Chicken Burger',
      'Chicken Hot Dog', 'Turkey Cutlet', 'Turkey Meatball', 'Turkey Deli Slice', 'Duck Leg', 'Duck Confit', 'Goose Meat',
      'Quail Meat', 'Cornish Hen', 'Lamb Shank', 'Lamb Shoulder', 'Lamb Kebab', 'Lamb Kofta', 'Merguez', 'Veal Cutlet',
      'Veal Chop', 'Veal Osso Buco', 'Wild Boar', 'Elk Meat', 'Kangaroo Meat', 'Alligator Meat', 'Plant Based Bacon',
      'Plant Based Deli Slice', 'Plant Based Hot Dog', 'Plant Based Meatball', 'Plant Based Nugget', 'Plant Based Tender',
      'Mushroom Meat Alternative', 'Mycoprotein Meat', 'Lupin Protein Meat', 'Fava Protein Meat',
    ],
  },
  {
    parentSlug: 'seafood',
    labels: [
      'King Salmon', 'Sockeye Salmon', 'Coho Salmon', 'Atlantic Salmon', 'Smoked Trout', 'Rainbow Trout', 'Arctic Char', 'Bluefin Tuna',
      'Albacore Tuna', 'Skipjack Tuna', 'Yellowtail', 'Hamachi', 'Branzino', 'Dover Sole', 'Rockfish', 'Perch', 'Pike', 'Walleye',
      'Carp', 'Milkfish', 'Herring', 'Kipper', 'Basa', 'Swai', 'John Dory', 'Tilefish', 'Bluefish', 'Amberjack',
      'Stone Crab', 'Dungeness Crab', 'King Crab', 'Snow Crab', 'Soft Shell Crab', 'Blue Crab', 'Rock Shrimp', 'Tiger Shrimp',
      'White Shrimp', 'Brown Shrimp', 'Spot Prawn', 'Geoduck', 'Razor Clam', 'Little Neck Clam', 'Manila Clam', 'Cockle',
      'Abalone', 'Uni', 'Sea Urchin', 'Sea Cucumber', 'Conch', 'Whelk', 'Smoked Fish', 'Salt Cod', 'Pickled Herring',
      'Canned Tuna', 'Canned Salmon', 'Canned Sardine', 'Tuna Salad Seafood', 'Salmon Burger', 'Fish Burger', 'Crab Stick',
      'Seafood Salad', 'Seafood Chowder Protein', 'Plant Based Fish', 'Plant Based Shrimp', 'Plant Based Crab Cake',
    ],
  },
  {
    parentSlug: 'egg',
    labels: [
      'Egg Yolk', 'Egg Custard Base', 'Egg Noodle Product', 'Egg Crepe', 'Tamago', 'Tamagoyaki', 'Scotch Egg', 'Pickled Egg',
      'Salted Duck Egg', 'Tea Egg', 'Cloud Egg', 'Baked Egg', 'Coddled Egg', 'Egg Souffle', 'Egg Casserole', 'Egg Tart Filling',
      'Vegan Scramble', 'Plant Based Scramble', 'Chickpea Egg', 'Tofu Scramble', 'Eggless Omelet',
    ],
  },
  {
    parentSlug: 'yogurt',
    labels: [
      'French Style Yogurt', 'Australian Yogurt', 'Bulgarian Yogurt', 'Set Yogurt', 'Stirred Yogurt', 'Cream Top Yogurt',
      'Fruit On Bottom Yogurt', 'Kids Yogurt', 'Yogurt Tube', 'Yogurt Pouch', 'Yogurt Parfait', 'Yogurt Drink Shot',
      'Kefir Smoothie', 'Goat Milk Yogurt', 'Sheep Milk Yogurt', 'Lactose Free Yogurt', 'High Protein Yogurt',
      'Greek Yogurt Cup', 'Skyr Cup', 'Dairy Free Yogurt', 'Pea Protein Yogurt', 'Cashew Yogurt Alternative',
    ],
  },
  {
    parentSlug: 'beverage',
    labels: [
      'Cold Pressed Juice', 'Nectar Beverage', 'Juice Drink', 'Fruit Punch', 'Agua Fresca', 'Cucumber Water', 'Aloe Drink',
      'Birch Water', 'Maple Water', 'Functional Water', 'Collagen Drink', 'Prebiotic Soda', 'Probiotic Soda', 'Craft Soda',
      'Cream Soda', 'Orange Soda', 'Grape Soda', 'Sparkling Lemonade', 'Arnold Palmer', 'Kombucha Tea', 'Nitro Coffee',
      'Canned Coffee', 'Ready To Drink Coffee', 'Coffee Concentrate', 'Coffee Creamer Drink', 'Tea Concentrate', 'Kombucha Shot',
      'Drinking Vinegar', 'Shrub Beverage', 'Kvass Drink', 'Malt Beverage', 'Non Alcoholic Beer', 'Non Alcoholic Wine',
      'Non Alcoholic Spirit', 'Canned Cocktail', 'Margarita', 'Martini', 'Negroni', 'Old Fashioned', 'Mojito', 'Pina Colada',
      'Soju', 'Mead', 'Kombucha Alcohol', 'Flavored Milk', 'Strawberry Milk', 'Banana Milk', 'Coffee Milk', 'Oat Milk Latte',
      'Almond Milk Latte', 'Soy Milk Drink', 'Pea Milk', 'Hemp Milk', 'Barley Tea', 'Oolong Tea', 'White Tea', 'Rooibos Tea',
      'Protein Water', 'Recovery Drink', 'Brain Health Drink', 'Fiber Drink', 'Greens Drink', 'Adaptogen Drink',
    ],
  },
  {
    parentSlug: 'snack',
    labels: [
      'Potato Crisp', 'Kettle Chip', 'Ridged Chip', 'Baked Chip', 'Multigrain Chip', 'Bean Chip', 'Lentil Chip', 'Chickpea Puff',
      'Pea Puff', 'Cheese Ball Snack', 'Corn Nut', 'Fried Corn Snack', 'Wasabi Pea', 'Sesame Stick', 'Bread Crisp',
      'Melba Toast', 'Snack Pretzel Rod', 'Soft Pretzel Bite', 'Savory Biscuit', 'Cheese Straw', 'Plant Based Jerky',
      'Mushroom Jerky', 'Watermelon Seed Snack', 'Pumpkin Seed Snack', 'Sunflower Seed Snack', 'Nut And Fruit Bar',
      'Date Bar', 'Fig Bar', 'Brownie Bar', 'Cookie Bar', 'Wafer Cookie', 'Sandwich Cookie', 'Filled Cookie',
      'Shortbread Cookie', 'Animal Cracker', 'Vanilla Wafer', 'Snack Pie', 'Mini Cupcake', 'Mini Brownie', 'Fruit Cup Snack',
      'Applesauce Pouch', 'Gel Snack', 'Pudding Cup Snack', 'Cheese Snack Cup', 'Yogurt Snack Cup',
    ],
  },
  {
    parentSlug: 'sauce',
    labels: [
      'Arrabbiata Sauce', 'Vodka Sauce', 'Bolognese Sauce', 'Ragu Sauce', 'Sugo', 'Salsa Verde', 'Romesco', 'Chermoula',
      'Nuoc Cham', 'Ponzu', 'Yuzu Kosho Sauce', 'Black Bean Sauce', 'Oyster Sauce', 'XO Sauce', 'Satay Sauce',
      'Sambal Oelek', 'Sambal Sauce', 'Nam Prik', 'Green Curry Paste', 'Red Curry Paste', 'Yellow Curry Paste',
      'Massaman Curry Paste', 'Panang Curry Paste', 'Korma Sauce', 'Vindaloo Sauce', 'Jalfrezi Sauce', 'Raita',
      'Mint Chutney', 'Mango Chutney', 'Tamarind Chutney', 'Cranberry Sauce', 'Apple Sauce', 'Chocolate Sauce',
      'Caramel Sauce', 'Fruit Coulis', 'Maple Syrup Sauce', 'Agave Syrup Sauce', 'Hot Honey', 'Chili Crisp',
      'Szechuan Sauce', 'Black Garlic Sauce', 'Mushroom Gravy', 'Onion Gravy', 'Vegan Gravy', 'Vegan Mayo',
      'Plant Based Ranch', 'Dairy Free Alfredo', 'Cashew Cream Sauce',
    ],
  },
  {
    parentSlug: 'fruit',
    labels: [
      'Blood Orange', 'Cara Cara Orange', 'Meyer Lemon', 'Key Lime', 'Clementine', 'Satsuma', 'Kumquat', 'Ugli Fruit',
      'Tangelo', 'White Grapefruit', 'Ruby Grapefruit', 'Champagne Grape', 'Concord Grape', 'Cotton Candy Grape',
      'Green Grape', 'Red Grape', 'Black Grape', 'Honeycrisp Apple', 'Granny Smith Apple', 'Gala Apple', 'Fuji Apple',
      'Pink Lady Apple', 'Ambrosia Apple', 'Bosc Pear', 'Anjou Pear', 'Asian Pear', 'Bartlett Pear', 'Ataulfo Mango',
      'Tommy Atkins Mango', 'Thai Mango', 'White Peach', 'Yellow Peach', 'Donut Peach', 'Rainier Cherry', 'Sour Cherry',
      'Black Cherry', 'Plantain Banana', 'Red Banana', 'Baby Banana', 'Cavendish Banana', 'Muskmelon', 'Canary Melon',
      'Galia Melon', 'Crenshaw Melon', 'Frozen Fruit Blend', 'Dried Mango', 'Dried Apricot', 'Raisin', 'Golden Raisin',
      'Candied Fruit', 'Fruit Puree', 'Fruit Compote',
    ],
  },
  {
    parentSlug: 'vegetable',
    labels: [
      'Romanesco', 'Broccolini', 'Rapini', 'Chinese Broccoli', 'Napa Cabbage', 'Savoy Cabbage', 'Mustard Green',
      'Dandelion Green', 'Beet Green', 'Turnip Green', 'Malabar Spinach', 'Mizuna', 'Tatsoi', 'Escarole', 'Frisee',
      'Butter Lettuce', 'Little Gem Lettuce', 'Gem Lettuce', 'Gem Squash', 'Pattypan Squash', 'Delicata Squash',
      'Kabocha Squash', 'Honeynut Squash', 'Chayote', 'Sunchoke', 'Jerusalem Artichoke', 'Celeriac', 'Celery Root',
      'Red Onion', 'White Onion', 'Yellow Onion', 'Vidalia Onion', 'Pearl Onion', 'Green Garlic', 'Garlic Scape',
      'Fiddlehead Fern', 'Ramps', 'Leek Green', 'Baby Corn', 'Purple Carrot', 'Rainbow Carrot', 'Golden Beet',
      'Chioggia Beet', 'Romanesco Zucchini', 'Yellow Squash', 'Maitake Mushroom', 'Enoki Mushroom', 'Oyster Mushroom',
      'King Oyster Mushroom', 'Lion Mane Mushroom', 'Morel Mushroom', 'Truffle Mushroom',
    ],
  },
  {
    parentSlug: 'grain-cereal',
    labels: [
      'Kamut', 'Einkorn', 'Triticale', 'Fonio', 'Job Tears', 'Wild Grain Mix', 'Multigrain Blend', 'Ancient Grain Blend',
      'Sprouted Grain', 'Rolled Oat', 'Steel Cut Oat', 'Quick Oat', 'Instant Oatmeal', 'Overnight Oat', 'Oat Bran',
      'Wheat Bran', 'Rice Bran', 'Corn Flake Cereal', 'Oat Ring Cereal', 'Chocolate Cereal', 'Cinnamon Cereal',
      'Honey Cereal', 'Children Cereal', 'Protein Cereal', 'Low Sugar Cereal', 'Gluten Free Cereal', 'Baby Cereal',
      'Barley Flake', 'Rye Flake', 'Quinoa Flake', 'Millet Flake',
    ],
  },
  {
    parentSlug: 'pasta-noodle',
    labels: [
      'Bucatini', 'Capellini', 'Angel Hair', 'Ditalini', 'Gemelli', 'Orecchiette', 'Paccheri', 'Radiatori', 'Rotini',
      'Shell Pasta', 'Manicotti', 'Agnolotti', 'Mezzelune', 'Pierogi', 'Wonton Wrapper', 'Dumpling Wrapper',
      'Vietnamese Rice Noodle', 'Pad Thai Noodle', 'Pho Noodle', 'Hokkien Noodle', 'Lo Mein Noodle', 'Chow Mein Noodle',
      'Bean Thread Noodle', 'Kelp Noodle', 'Zucchini Noodle', 'Chickpea Pasta', 'Lentil Pasta', 'Black Bean Pasta',
      'Gluten Free Pasta', 'Protein Pasta', 'Whole Wheat Pasta',
    ],
  },
  {
    parentSlug: 'rice',
    labels: [
      'Medium Grain Rice', 'Short Grain Rice', 'Long Grain Rice', 'Parboiled Rice', 'Converted Rice', 'Instant Rice',
      'Microwave Rice', 'Rice Cup', 'Rice Noodle Sheet', 'Rice Vermicelli', 'Rice Paper', 'Rice Cracker Base',
      'Rice Flour Product', 'Sticky Rice Dessert', 'Coconut Rice', 'Yellow Rice', 'Dirty Rice', 'Red Beans And Rice',
      'Rice And Peas', 'Biryani Rice', 'Pulao Rice',
    ],
  },
  {
    parentSlug: 'legume',
    labels: [
      'White Bean', 'Borlotti Bean', 'Cranberry Bean', 'Roman Bean', 'Tepary Bean', 'Mayocoba Bean', 'Anasazi Bean',
      'Scarlet Runner Bean', 'Horse Gram', 'Pigeon Pea', 'Cowpea', 'Lupin Bean', 'Lupin Protein', 'Fava Protein',
      'Chickpea Flour', 'Gram Flour', 'Besan', 'Soy Flour', 'Soy Nugget', 'Soy Crumble', 'Pea Crumble',
      'Lentil Crumble', 'Bean Burger', 'Lentil Burger', 'Chickpea Burger', 'Tofu Skin', 'Yuba', 'Soy Yogurt Base',
    ],
  },
  {
    parentSlug: 'nut-seed',
    labels: [
      'Marcona Almond', 'Blanched Almond', 'Roasted Almond', 'Smoked Almond', 'Candied Pecan', 'Roasted Cashew',
      'Raw Cashew', 'Roasted Peanut', 'Boiled Peanut', 'Peanut Powder', 'Walnut Butter', 'Pistachio Butter',
      'Tahini Paste', 'Black Sesame', 'White Sesame', 'Sesame Paste', 'Pumpkin Seed Butter', 'Hemp Heart',
      'Ground Flaxseed', 'Seed Cracker', 'Nut Flour', 'Almond Flour', 'Coconut Flour', 'Peanut Flour',
    ],
  },
  {
    parentSlug: 'dessert',
    labels: [
      'Tres Leches Cake', 'Black Forest Cake', 'Opera Cake', 'Madeleine', 'Financier', 'Petit Four', 'Profiterole',
      'Mille Feuille', 'Napoleon Dessert', 'Basque Cheesecake', 'Japanese Cheesecake', 'Flourless Chocolate Cake',
      'Lava Cake', 'Blondie', 'Whoopie Pie', 'Moon Pie', 'Hand Pie', 'Key Lime Pie', 'Pecan Pie', 'Pumpkin Pie',
      'Apple Pie', 'Cherry Pie', 'Lemon Meringue Pie', 'Banoffee Pie', 'Sticky Toffee Pudding', 'Chocolate Pudding',
      'Vanilla Pudding', 'Tapioca Pudding', 'Semolina Pudding', 'Kheer', 'Gulab Jamun', 'Rasgulla', 'Jalebi',
      'Kulfi Dessert', 'Mochi Cake', 'Dorayaki', 'Taiyaki',
    ],
  },
  {
    parentSlug: 'frozen-dessert',
    labels: [
      'Sherbet Cup', 'Frozen Yogurt Cup', 'Frozen Yogurt Bar', 'Ice Milk', 'Frozen Cheesecake', 'Frozen Eclair',
      'Frozen Cream Puff', 'Frozen Pie', 'Frozen Parfait', 'Frozen Sundae', 'Sundae Cup', 'Gelato Pint',
      'Sorbet Pint', 'Frozen Smoothie Bowl', 'Acai Bowl Frozen', 'Frozen Banana Dessert', 'Frozen Mochi Dessert',
      'Dairy Free Frozen Dessert', 'Protein Ice Cream', 'Low Sugar Ice Cream',
    ],
  },
  {
    parentSlug: 'confectionery',
    labels: [
      'Peanut Butter Cup', 'Chocolate Truffle', 'Chocolate Covered Almond', 'Chocolate Covered Peanut', 'Chocolate Covered Raisin',
      'Chocolate Covered Pretzel', 'Chocolate Bark', 'Chocolate Wafer', 'Caramel Popcorn', 'Nougat Bar', 'Marzipan',
      'Fondant Candy', 'Rock Candy', 'Sour Belt', 'Fruit Snack Candy', 'Fruit Gummy', 'Vitamin Gummy', 'Chewing Gum',
      'Bubble Gum', 'Breath Mint', 'Lozenge', 'Butterscotch Candy', 'Peppermint Candy', 'Coconut Candy',
    ],
  },
  {
    parentSlug: 'soup',
    labels: [
      'Tortilla Soup', 'Chicken Tortilla Soup', 'Chicken Rice Soup', 'Turkey Soup', 'Seafood Bisque', 'Lobster Bisque',
      'Crab Bisque', 'Clam Chowder', 'Corn Chowder', 'Cream Of Tomato Soup', 'Cream Of Mushroom Soup',
      'Cream Of Chicken Soup', 'Italian Wedding Soup', 'Avgolemono', 'Harira', 'Tom Yum', 'Tom Kha', 'Hot And Sour Soup',
      'Egg Drop Soup Bowl', 'Wonton Soup', 'Udon Soup', 'Soba Soup', 'Sancocho', 'Caldo Verde',
    ],
  },
  {
    parentSlug: 'ready-meal',
    labels: [
      'Chicken Parmesan', 'Eggplant Parmesan', 'Meatball Sub', 'Sloppy Joe', 'Pulled Pork Sandwich', 'Reuben Sandwich',
      'BLT Sandwich', 'Club Sandwich', 'Grilled Cheese Sandwich', 'Breakfast Bowl', 'Oatmeal Bowl', 'Rice Bowl',
      'Burrito Bowl', 'Taco Bowl', 'Noodle Bowl', 'Ramen Bowl', 'Curry Bowl', 'Teriyaki Bowl', 'Korean BBQ Bowl',
      'Mediterranean Bowl', 'Salmon Bowl', 'Chicken Bowl', 'Steak Bowl', 'Tofu Bowl', 'Tempeh Bowl', 'Bean Bowl',
      'Enchilada Meal', 'Fajita Meal', 'Tostada', 'Gordita', 'Empanada', 'Arepa Meal', 'Pupusa', 'Samosa',
      'Spring Roll', 'Egg Roll', 'Banh Mi', 'Katsu', 'Katsu Curry', 'Teriyaki Chicken', 'General Tso Chicken',
      'Orange Chicken', 'Kung Pao Chicken', 'Mapo Tofu', 'Dan Dan Noodle', 'Green Curry Meal', 'Red Curry Meal',
      'Massaman Curry Meal', 'Pierogi Meal', 'Goulash', 'Ratatouille', 'Moussaka', 'Spanakopita',
    ],
  },
  {
    parentSlug: 'salad',
    labels: [
      'Spinach Salad', 'Romaine Salad', 'Spring Mix Salad', 'Chopped Salad', 'Southwest Salad', 'Asian Slaw',
      'Cucumber Salad', 'Tomato Salad', 'Beet Salad', 'Carrot Salad', 'Broccoli Salad', 'Brussels Sprout Salad',
      'Farro Salad', 'Couscous Salad', 'Rice Salad', 'Noodle Salad', 'Poke Salad', 'Antipasto Salad',
    ],
  },
  {
    parentSlug: 'oil-fat',
    labels: [
      'Rice Bran Oil', 'Cottonseed Oil', 'Mustard Oil', 'Flaxseed Oil', 'Hemp Oil', 'Pumpkin Seed Oil', 'Truffle Oil',
      'Chili Oil', 'Garlic Oil', 'Herb Oil', 'Compound Butter', 'Plant Butter', 'Vegan Butter', 'Whipped Butter',
      'Butter Blend', 'Cocoa Butter', 'Shea Butter Food Grade',
    ],
  },
  {
    parentSlug: 'fermented-pickle',
    labels: [
      'Pickled Cucumber', 'Bread And Butter Pickle', 'Sweet Pickle', 'Sour Pickle', 'Half Sour Pickle',
      'Pickled Green Bean', 'Pickled Okra', 'Pickled Mushroom', 'Pickled Eggplant', 'Pickled Cabbage',
      'Pickled Radish', 'Pickled Daikon', 'Pickled Turnip', 'Fermented Carrot', 'Fermented Beet',
      'Fermented Cabbage', 'Fermented Soybean', 'Soybean Paste', 'Red Miso', 'White Miso', 'Barley Miso',
      'Rice Vinegar', 'Wine Vinegar', 'Malt Vinegar', 'Sherry Vinegar',
    ],
  },
];
