"""
Seed the database with realistic demo items — 55+ per category.

Usage:
    python manage.py seed_items                 # create if none exist (idempotent)
    python manage.py seed_items --reset         # delete existing seed items/users and recreate
    python manage.py seed_items --per-category 60

All seeded items belong to dedicated ``seed_user_NN@ns.local`` accounts and are
scattered across Harare suburbs so they show up in the browse/search experience.
"""
import random
from datetime import timedelta

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from items.models import Item, Category, ItemTier, TradeType, ListingType
from users.models import User, UserProfile

SEED_USER_PREFIX = 'seed_user_'
SEED_USER_DOMAIN = 'ns.local'
SEED_PASSWORD = 'Seedpass123!'

SEED_USERS = 24

# Harare suburb anchors (lat, lng) close to the search centre (-17.7833, 31.05)
SUBURBS = [
    ('Avenues', -17.812, 31.043),
    ('Belgravia', -17.797, 31.047),
    ('Avondale', -17.787, 31.036),
    ('Mt Pleasant', -17.775, 31.044),
    ('Newlands', -17.775, 31.073),
    ('Highlands', -17.805, 31.073),
    ('Greendale', -17.793, 31.073),
    ('Borrowdale', -17.752, 31.065),
    ('Eastlea', -17.835, 31.063),
    ('CBD', -17.829, 31.052),
    ('Mabelreign', -17.818, 31.003),
    ('Westgate', -17.845, 31.010),
]

FIRST_NAMES = [
    'Tendai', 'Rudo', 'Tafadzwa', 'Chipo', 'Farai', 'Nyasha', 'Tariro', 'Simba',
    'Kudzai', 'Rutendo', 'Takudzwa', 'Vimbai', 'Tinashe', 'Fadzai', 'Blessing',
    'Memory', 'Panashe', 'Shamiso', 'Tanaka', 'Munashe', 'Tawanda', 'Linda',
    'Kundai', 'Tsitsi',
]
LAST_NAMES = [
    'Moyo', 'Ncube', 'Chikore', 'Dube', 'Sithole', 'Gumbo', 'Mutasa', 'Banda',
    'Mazvita', 'Chirwa', 'Maposa', 'Zhou', 'Khumalo', 'Ndlovu', 'Sibanda',
    'Mugabe', 'Chimuka', 'Madzivire', 'Mupfumi', 'Ruzvidzo', 'Hove', 'Mawere',
    'Chikanga', 'Nyamukapa',
]

# (brand/qualifier, item) families per category — combined with condition
# suffixes to produce 55+ unique, realistic titles per category.
SEED_DATA = {
    Category.TOOLS: [
        ('Bosch', 'Cordless Drill'), ('Makita', 'Circular Saw'), ('Stanley', 'Claw Hammer'),
        ('Black+Decker', 'Screwdriver Set'), ('Ryobi', 'Angle Grinder'), ('DeWalt', 'Impact Driver'),
        ('Worx', 'Electric Hedge Trimmer'), ('Irwin', 'Quick-Grip Clamp Set'), ('Knipex', 'Pliers Set'),
        ('Bosch', 'Jigsaw'), ('Stanley', 'Tape Measure Set'), ('Makita', 'Orbital Sander'),
        ('Milwaukee', 'Reciprocating Saw'), ('Tacklife', 'Stud Finder'), ('Wera', 'Socket Set'),
    ],
    Category.GARDEN_EQUIPMENT: [
        ('Husqvarna', 'Petrol Lawn Mower'), ('Flymo', 'Electric Hedge Trimmer'),
        ('Gardena', 'Irrigation Watering Set'), ('Wolf', 'Garden Fork'), ('Stihl', 'Bush Cutter'),
        ('Black+Decker', 'Leaf Blower'), ('Spear & Jackson', 'Garden Shovel'),
        ('Fiskars', 'Pruning Shears'), ('Bosch', 'Electric Rotavator'),
        ('Einhell', 'Pressure Sprayer'), ('Webb', 'Garden Cultivator'), ('Solid', 'Wheelbarrow'),
        ('Dewalt', 'Chainsaw'), ('Ole', 'Mac Greenhouse Shelving'), ('Karcher', 'Garden Pump'),
    ],
    Category.KITCHEN_APPLIANCES: [
        ('Kenwood', 'Stand Mixer'), ('Breville', 'Food Processor'), ('Philips', 'Air Fryer'),
        ('Russell Hobbs', 'Blender'), ('Ninja', 'Multi Cooker'), ('Delonghi', 'Espresso Machine'),
        ('Samsung', 'Microwave Oven'), ('Tefal', 'Crepe Maker'), ('Smeg', 'Retro Toaster'),
        ('KitchenAid', 'Hand Blender'), ('Bosch', 'Countertop Dishwasher'),
        ('Morphy Richards', 'Slow Cooker'), ('Russell Hobbs', 'Kettle'), ('Sunbeam', 'Waffle Maker'),
        ('Breville', 'Juice Extractor'),
    ],
    Category.ELECTRONICS: [
        ('Dell', 'XPS 13 Laptop'), ('HP', 'EliteBook'), ('Apple', 'MacBook Air M2'),
        ('Samsung', 'Galaxy S23 Phone'), ('LG', '55" 4K Smart TV'), ('Sony', 'Bluetooth Speaker'),
        ('JBL', 'PartyBox Speaker'), ('Canon', 'EOS DSLR Camera'), ('Xbox', 'Series S Console'),
        ('PlayStation', '5 DualSense Controller'), ('Apple', 'iPad 10th Gen'),
        ('DJI', 'Mini 3 Drone'), ('Samsung', 'Galaxy Tab'), ('Bose', 'QuietComfort Headphones'),
        ('Anker', 'Power Bank'),
    ],
    Category.SPORTS_EQUIPMENT: [
        ('Decathlon', 'Mountain Bike'), ('Yonex', 'Badminton Racket'), ('Wilson', 'Tennis Racket'),
        ('Nike', 'Match Football'), ('Adidas', 'Dumbbell Set'), ('Reebok', 'Yoga Mat'),
        ('Salming', 'Squash Racket'), ('Spalding', 'Basketball'), ('ProForm', 'Treadmill'),
        ('Ogio', 'Golf Club Set'), ('Speedo', 'Swim Goggles'), ('Casio', 'Stopwatch Set'),
        ('Everlast', 'Boxing Gloves'), ('Vuly', 'Trampoline'), ('Decathlon', 'Fishing Rod Set'),
    ],
    Category.MUSICAL_INSTRUMENTS: [
        ('Fender', 'Stratocaster Electric Guitar'), ('Yamaha', 'PSR Keyboard'),
        ('Roland', 'TD-1 Drum Kit'), ('Ibanez', 'Acoustic Guitar'), ('Casio', 'Digital Piano'),
        ('Pearl', 'Snare Drum'), ('Shure', 'SM58 Microphone'), ('Marshall', 'Guitar Amp'),
        ('Squier', 'Bass Guitar'), ('Zildjian', 'Cymbal Set'), ('Alesis', 'MIDI Keyboard'),
        ('Remo', 'Djembe Drum'), ('Fender', 'Acoustic Guitar'), ('Behringer', 'DJ Mixer'),
        ('Korg', 'Synthesizer'),
    ],
    Category.CAMERAS_PHOTOGRAPHY: [
        ('Canon', 'EOS 90D Body'), ('Nikon', 'Z50 Mirrorless'), ('Sony', 'Alpha 6400 Kit'),
        ('GoPro', 'Hero 11 Action Cam'), ('Manfrotto', 'Pro Tripod'), ('DJI', 'Osmo Gimbal'),
        ('Godox', 'Studio Light Kit'), ('Tamron', '70-200mm Zoom Lens'), ('Fujifilm', 'Instax Camera'),
        ('Rode', 'VideoMic Shotgun'), ('Lowepro', 'Camera Backpack'), ('Fotodiox', 'Reflector Kit'),
        ('Canon', '50mm Prime Lens'), ('Sony', 'Vlogging Kit'), ('Sennheiser', 'Lavalier Mic'),
    ],
    Category.BABY_CHILDREN: [
        ('Joie', 'Miralite Stroller'), ('Chicco', 'Baby Cot'), ('Graco', 'Car Seat'),
        ('Fisher-Price', 'Activity Gym'), ('Maxi-Cosi', 'High Chair'),
        ('Tommee Tippee', 'Baby Monitor'), ('Little Tikes', 'Tricycle'), ('Skip Hop', 'Play Mat'),
        ('Philips Avent', 'Steriliser'), ('Mothercare', 'Nappy Bag'), ('VTech', 'Learning Tablet'),
        ('BabyBjorn', 'Baby Carrier'), ('Jolly Jumper', 'Baby Bouncer'), ('Ikea', 'Changing Table'),
        ('Safety 1st', 'Playpen'),
    ],
    Category.BOOKS_STATIONERY: [
        ('Oxford', 'Dictionary Set'), ('Penguin', 'Classics Collection'),
        ('Cambridge', 'A-Level Textbooks'), ('Moleskine', 'Notebook Set'),
        ('Staedtler', 'Pencil Set'), ('Faber-Castell', 'Art Supply Kit'), ('Oxford', 'School Atlas'),
        ('National Geographic', 'Travel Guides'), ('Dr Seuss', 'Children Book Set'),
        ('Lonely Planet', 'Zimbabwe Guide'), ('CGP', 'Revision Guide Set'),
        ('Parker', 'Fountain Pen Set'), ('DK', 'Encyclopaedia Set'), ('Roald Dahl', 'Collection'),
        ('Priddy', 'Toddler Board Books'),
    ],
    Category.CLOTHING_ACCESSORIES: [
        ('Zara', 'Winter Jacket'), ('Adidas', 'Running Shoes'), ('Guess', 'Handbag'),
        ('Levi', 'Denim Jeans'), ('Nike', 'Sports Jacket'), ('Gucci', 'Leather Belt'),
        ('Ray-Ban', 'Aviator Sunglasses'), ('Fossil', 'Chronograph Watch'),
        ('The North Face', 'Rain Coat'), ('G-Star Raw', 'Denim Jacket'), ('Burberry', 'Scarf'),
        ('Timberland', 'Classic Boots'), ('H&M', 'Formal Shirt Set'), ('Tommy Hilfiger', 'Polo Set'),
        ('Converse', 'Chuck Taylors'),
    ],
    Category.FURNITURE: [
        ('Ikea', 'Dining Table'), ('Leather', '3-Seater Sofa'), ('Loft', 'Bookshelf'),
        ('Solid Wood', 'Queen Bed Frame'), ('Ergonomic', 'Office Chair'), ('Walnut', 'Coffee Table'),
        ('Solid Pine', 'Wardrobe'), ('Velvet', 'Accent Chair'), ('Glass', 'TV Stand'),
        ('Rattan', 'Outdoor Lounge Set'), ('Bunk', 'Kids Bed'), ('Height-Adjustable', 'Standing Desk'),
        ('Extending', 'Boardroom Table'), ('Bean Bag', 'X-Large'), ('Teak', 'Patio Bench'),
    ],
    Category.VEHICLES_TRANSPORT: [
        ('Toyota', 'Corolla — Weekend Hire'), ('Honda', 'CBR Motorcycle'), ('Bajaj', 'Boxer Bike'),
        ('Giant', 'Road Bicycle'), ('Toyota', 'Hilux Trailer'), ('Kawasaki', 'Dirt Bike'),
        ('Isuzu', 'Single Cab'), ('Segway', 'Ninebot Scooter'), ('Xiaomi', 'Electric Scooter'),
        ('Thule', 'Roof Rack Bars'), ('Thule', 'Towball Bike Rack'), ('VW', 'Golf — Short Hire'),
        ('Suzuki', 'Swift — Day Hire'), ('Nissan', 'Navara Canopy'), ('Honda', 'Golf Buggy'),
    ],
    Category.PARTY_EVENTS: [
        ('PartyPro', '3x3 Gazebo'), ('PartyPro', 'Round Table Set'), ('Inflatable', 'Bouncy Castle'),
        ('SoundLine', 'PA Speaker System'), ('Disco', 'Lighting Kit'), ('Stadium', 'Folding Chairs'),
        ('Elegant', 'Wedding Arch'), ('Gold Medal', 'Popcorn Machine'),
        ('Gold Medal', 'Candyfloss Machine'), ('Disco', 'Mirror Ball'), ('DJ', 'Booth Table'),
        ('Fairy', 'String Lights'), ('Banquet', 'Table Cloths'), ('Stainless', 'Chafing Dishes'),
        ('Wooden', 'Rustic Sign Boards'),
    ],
    Category.CLEANING_EQUIPMENT: [
        ('Karcher', 'Pressure Washer'), ('Dyson', 'V11 Vacuum Cleaner'), ('Bissell', 'Carpet Cleaner'),
        ('Hoover', 'Steam Mop'), ('Vileda', 'Industrial Floor Cleaner'),
        ('Karcher', 'Industrial Vacuum'), ('Black+Decker', 'Floor Scrubber'),
        ('Karcher', 'Window Vac'), ('Electrolux', 'Cylinder Vacuum'), ('Miele', 'Upright Vacuum'),
        ('Shark', 'Robotic Vacuum'), ('Prochem', 'Carpet Extractor'), ('Nilfisk', 'Wet/Dry Vac'),
        ('Bissell', 'Upholstery Cleaner'), ('Karcher', 'High-Pressure Lance Set'),
    ],
    Category.MEDICAL_HEALTH: [
        ('Drive', 'Steel Wheelchair'), ('Medline', 'Walking Frame'), ('Omron', 'Blood Pressure Monitor'),
        ('Invacare', 'Adjustable Crutches'), ('A&D', 'Digital Scale'), ('Carex', 'Knee Walker'),
        ('Roho', 'Seating Cushion'), ('Drive', 'Shower Chair'), ('First Aid', 'Complete Kit'),
        ('Braun', 'Thermoscan Thermometer'), ('Omron', 'Nebulizer'), ('Seca', 'Baby Scale'),
        ('Drive', 'Commode Chair'), ('Physio', 'Theraband Set'), ('Omron', 'Digital Pulse Oximeter'),
    ],
    Category.OFFICE_EQUIPMENT: [
        ('HP', 'LaserJet Printer'), ('Epson', 'Business Projector'), ('Fellowes', 'Laminator'),
        ('Dell', '27" Monitor'), ('Logitech', 'Conference Webcam'), ('Bostitch', 'Stapler Set'),
        ('Herman Miller', 'Aeron Chair'), ('Fellowes', 'Paper Shredder'), ('Jabra', 'Conference Mic'),
        ('Magnetic', 'Whiteboard 2x1m'), ('Brother', 'Label Printer'), ('Kyocera', 'Multifunction Copier'),
        ('Ricoh', 'Document Scanner'), ('Novel', 'Flip Chart Easel'), ('Xerox', 'Binding Machine'),
    ],
    Category.OUTDOOR_CAMPING: [
        ('Coleman', '4-Person Dome Tent'), ('Osprey', 'Hiking Backpack'), ('Vango', 'Sleeping Bag'),
        ('Weber', 'Charcoal BBQ'), ('Jetboil', 'Cooking Stove'), ('The North Face', 'Camp Chair'),
        ('Marmot', 'Sleeping Pad'), ('Karrimor', 'Trekking Poles'), ('Bluesky', 'Camping Gazebo'),
        ('Igloo', 'Cooler Box'), ('Petzl', 'Head Torch'), ('Trespass', 'Waterproof Jacket'),
        ('Coleman', 'Lantern'), ('Sea to Summit', 'Camp Cutlery Set'), ('Quechua', 'Family Tent'),
    ],
    Category.OTHER: [
        ('Multi-Purpose', 'Extension Ladder'), ('Workshop', 'Tool Chest'), ('Garage', 'Air Compressor'),
        ('Honda', 'Portable Generator'), ('Battery', 'Jump Starter Pack'), ('Singer', 'Sewing Machine'),
        ('Singer', 'Overlocker'), ('Cricut', 'Explore Cutter'), ('Bosch', 'Heat Gun'),
        ('Tacklife', 'Stud Finder Kit'), ('Rubi', 'Tile Cutter'), ('Heavy Duty', 'Bench Vice'),
        ('Ryobi', 'Paint Sprayer'), ('Laser', 'Distance Measurer'), ('Staple', 'Air Staple Gun'),
    ],
}

# Condition suffixes used to expand families into 55+ titles per category
SUFFIXES = ['', ' — Like New', ' — Barely Used', ' — Excellent Condition', ' — Gently Used', ' — Good Condition']


def _make_title(brand, item, suffix):
    return f"{brand} {item}{suffix}"


class Command(BaseCommand):
    help = 'Seed 55+ realistic demo items per category around Harare'

    def add_arguments(self, parser):
        parser.add_argument('--per-category', type=int, default=55, help='Items per category (default: 55)')
        parser.add_argument('--reset', action='store_true', help='Delete existing seed items/users first')

    def handle(self, *args, **options):
        per_category = max(1, options['per_category'])
        rng = random.Random(42)

        existing_seed_items = Item.objects.filter(owner__username__startswith=SEED_USER_PREFIX).count()
        if existing_seed_items and not options['reset']:
            raise CommandError(
                f"{existing_seed_items} seed items already exist. Run with --reset to rebuild them."
            )

        if options['reset']:
            deleted_items, _ = Item.objects.filter(owner__username__startswith=SEED_USER_PREFIX).delete()
            deleted_users, _ = User.objects.filter(username__startswith=SEED_USER_PREFIX).delete()
            self.stdout.write(f"Removed {deleted_items} seed items and {deleted_users} seed users.")

        # --- Create seed users ---
        seed_users = []
        for i in range(1, SEED_USERS + 1):
            username = f"{SEED_USER_PREFIX}{i:02d}@{SEED_USER_DOMAIN}"
            suburb, lat, lng = SUBURBS[i % len(SUBURBS)]
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': username,
                    'first_name': FIRST_NAMES[i % len(FIRST_NAMES)],
                    'last_name': LAST_NAMES[(i * 3) % len(LAST_NAMES)],
                    'is_active': True,
                    'trust_score': rng.randint(60, 95),
                },
            )
            if created:
                user.set_password(SEED_PASSWORD)
                user.save()
            profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'registration_step': 4,
                    'email_verified': True,
                    'national_id_verified': True,
                    'is_active': True,
                    'home_address': f"{rng.randint(1, 200)} {suburb} Road, {suburb}, Harare",
                    'home_location': Point(lng, lat, srid=4326),
                    'trust_score': user.trust_score,
                },
            )
            seed_users.append(user)

        self.stdout.write(f"Using {len(seed_users)} seed users.")

        # --- Create items ---
        total_created = 0
        today = timezone.now().date()
        for category, families in SEED_DATA.items():
            created_for_category = 0
            idx = 0
            while created_for_category < per_category:
                brand, item_name = families[idx % len(families)]
                suffix = SUFFIXES[(idx // len(families)) % len(SUFFIXES)]
                title = _make_title(brand, item_name, suffix)

                owner = seed_users[idx % len(seed_users)]
                suburb, lat, lng = SUBURBS[idx % len(SUBURBS)]
                jitter_lat = rng.uniform(-0.012, 0.012)
                jitter_lng = rng.uniform(-0.012, 0.012)
                location = Point(lng + jitter_lng, lat + jitter_lat, srid=4326)

                credits = rng.choices(
                    population=[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20],
                    weights=[12, 18, 16, 14, 10, 8, 6, 5, 4, 4, 3],
                    k=1,
                )[0]
                if credits <= 5:
                    tier = ItemTier.TIER_1
                elif credits <= 12:
                    tier = ItemTier.TIER_2
                else:
                    tier = ItemTier.TIER_3

                trade_roll = rng.random()
                if trade_roll < 0.7:
                    trade_type, trade_details = TradeType.OPEN_OFFER, ''
                elif trade_roll < 0.85:
                    trade_type, trade_details = TradeType.SPECIFIC_TRADE, 'Happy to trade for anything similar in value.'
                else:
                    trade_type, trade_details = TradeType.COMMUNITY_CREDIT, ''

                listing_type = ListingType.SERVICE if rng.random() < 0.06 else ListingType.ITEM

                description = (
                    f"{title} available to borrow from a verified NeighbourShare member in "
                    f"{Category(category).label}. "
                    f"Well cared for and ready to use — perfect for your short-term needs. "
                    f"Just {credits} community time credit(s) per day."
                )

                Item.objects.create(
                    owner=owner,
                    title=title,
                    description=description,
                    category=category,
                    listing_type=listing_type,
                    tier=tier,
                    trade_type=trade_type,
                    trade_request_details=trade_details,
                    time_credits_per_day=credits,
                    is_available=True,
                    location=location,
                    availability_calendar=[
                        (today + timedelta(days=d)).isoformat()
                        for d in rng.sample(range(1, 60), k=rng.randint(5, 12))
                    ],
                )
                created_for_category += 1
                total_created += 1
                idx += 1

            self.stdout.write(self.style.SUCCESS(
                f"  {Category(category).label}: {created_for_category} items"
            ))

        self.stdout.write(self.style.SUCCESS(
            f"\nDone! Created {total_created} seed items across {len(SEED_DATA)} categories. "
            f"Total items now: {Item.objects.count()}."
        ))
