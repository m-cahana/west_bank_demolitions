import pandas as pd
import googlemaps
# import API key from uncommited file
from constants import google_maps_api_key
import geopandas as gpd
from rapidfuzz import process, fuzz
import numpy as np

# ----- data read-in -----
df = pd.read_csv('../raw/demolitions.csv')

gdf = gpd.read_file('../raw/palestiniancommunities_wb_gs/PalestinianCommunities_WB_GS.shp')

# ----- functions -----

def lowercase_titles(df): 
    df.columns  = [c.lower().replace(' ', '_') for c in df.columns]

    return df 

def clean_cols(df):
   df = lowercase_titles(df)

   df['date_of_demolition'] = pd.to_datetime(df['date_of_demolition'], format='%Y-%m-%d')

   df['area'] = (
      df['area'].str.replace('-', ' ') \
        .str.replace('\s+', ' ', regex=True) \
            .str.strip() \
                .str.title()
   )

   df['locality_cleaned'] = df['locality'].str.replace(
       'Kh.', 'Khirbet').str.replace(
           'a-', 'al-')

   df = df.rename(columns = {'type_of_sturcture': 'type_of_structure'})
   
   return df 

def get_lat_long(row):

    try:
        town = (
            row['locality_cleaned']
        )

        print(town)

        geocode_result = gmaps.geocode(town)

        return (
            str(geocode_result[0]['geometry']['location']['lat']) + 
            ',' + 
            str(geocode_result[0]['geometry']['location']['lng'])
        )
    except:
        print('none found')
        return 'null'

def find_best_match(query, choices, scorer=fuzz.token_sort_ratio, threshold=90):
    
    match = process.extractOne(query, choices, scorer=scorer)
    if match and match[1] >= threshold:
        return match[0]
    return None

# ---- processing -----

df = clean_cols(df)
gdf = lowercase_titles(gdf)
gdf = gdf.rename(columns = {'x': 'long', 'y': 'lat'})


# ---- fuzzy matching locations -----

locations = df[['locality', 'locality_cleaned', 'district', 'area']].drop_duplicates()
pcbs_names = gdf['pcbs_name'].tolist()
locations['pcbs_match'] = locations['locality_cleaned'].apply(lambda x: find_best_match(x, pcbs_names, scorer=fuzz.token_sort_ratio, threshold=90))
locations['match'] = locations.pcbs_match.notna()
locations['precise_match'] = (locations.pcbs_match == locations.locality)

# double checked these, they look good
# locations[(locations.match) & (~locations.precise_match)]

# ---- geocode locations -----

gmaps = googlemaps.Client(key=google_maps_api_key)

remaining_locations = locations[~locations.match]

remaining_locations['lat_long'] = remaining_locations.apply(get_lat_long, axis = 1)
remaining_locations['lat'] = remaining_locations.lat_long.str.split(',', expand=True)[0]
remaining_locations['lat'] = remaining_locations.lat.replace('null', np.nan).astype(float)
remaining_locations['long'] = remaining_locations.lat_long.str.split(',', expand=True)[1]
remaining_locations['long'] = remaining_locations.long.replace('null', np.nan).astype(float)

# ---- manually assign locations for all remaining -----

remaining_locations_to_fix = remaining_locations[
    ((remaining_locations.lat < 31.3)  | (remaining_locations.lat > 32.5)) | 
    ((remaining_locations.long < 34.9)  | (remaining_locations.long > 35.55)) | 
    (remaining_locations.lat_long == 'null')
]

# done manually using google maps and 
# btselem's interactive map: 
# https://www.btselem.org/map
manual_adjustments = {
    "a-Nabi Elyas": [32.1846492, 35.0057892], 
    "Shuyukh al-'Arrub": [31.6171211, 35.104552], 
    "a-Nuwei'mah al-Foqa": [31.8917063, 35.4265132], 
    "a-Ramadin": [31.3756506, 34.8667902],
    "a-Dhahiriyah": [31.4096371, 34.9652083],
    "Kafr a-Dik": [32.0685947, 35.042139],
    "a-Samu'": [31.3986091, 35.0549883],
    "Kh.a-Twayel": [32.1016731,35.3576984], 
    "a-Nabi Samwil": [31.8354589, 35.1615204],
    "Barta'ah a-Sharqiyah": [32.4678335, 35.0301413],
    "al-Burj": [31.4428272, 34.882206],
    "Kh. Um al-Jamal": [32.3286995,35.4972817],
    "a-Zawiya": [32.375082, 35.1589397],
    "Jaba' 'Ararah": [31.8626963,35.2414694],
    "Kh. Jurat al-Jamal": [31.4125931, 35.1023235],
    "a-Rakeez": [31.4058016, 35.1478468],
    "a-Sawiyah": [32.0851641, 35.2464613],
    "a-Za'ayem": [31.7821381, 35.2488158],
    "al-Farisiyah (Nab'a al-Ghazal)": [32.3223088, 35.4961477],
    "a-Lubban a-Sharqiyah": [32.0812704, 35.1888585],
    "'Ein a-Duyuk a-Tahta": [31.8651926, 35.4306096],
    "al-'Arrub R.C.": [31.6170846, 35.1045522],
    "al-'Aqabah": [32.3377522, 35.4103511],
    "Turah a-Sharqiyah": [32.466283, 35.1612704],
    "Um a-Rihan": [32.4816165, 35.1398502],
    "Kh. Jubara": [32.2684294,35.0220725], 
    "Farsh al-Hawa": [31.5776899, 35.1240151],
    "Bidu": [31.8392574, 35.0209684],
    "Kh. a-Tiran": [31.3911329, 35.0135891],
    "al-Jawaya": [31.4235182,35.1503276],
    "al-Baq'ah (Hebron)": [31.540024, 35.108817],
    "Kh. Tatrit ('Arab al-Freijat)": [31.3572657, 34.900098],
    "Dahiyat al-Bareed": [31.8456998, 35.2296942],
    # can't find it, just putting it in Hebron
    "al-Haskah": [31.5340022, 35.0769842],
    "She'b al-Batem": [31.4031693, 35.1065866],
    "Kh. Twayel": [32.1016731,35.3576984], 
    # just placing in Jericho
    "Kh. 'Allan": [31.8594663, 35.4255391],
    "al-'Auja": [31.93845, 35.4525693],
    "'Aqbat Jaber R.C.": [31.8420471, 35.4352643],
    "Kh. Um Qusah": [31.446932, 35.1701477],
    "Wa'r al-Beik": [31.8063469, 35.2591045],
    "Khalet al-Furn": [31.4768487, 35.1464042],
    "a-Tiran": [31.3911329, 35.0135891],
    "Shaqba": [31.9890821, 35.0292163],
    "Kh. Lasefar": [31.3654673, 35.1059756],
    "al-Maniyah": [31.6199902,35.2158272],
    "a-Deirat": [31.4454701,35.1597915],
    "Kh. Wadi Ejheish": [31.3805489, 35.0964301],
    "Irtas": [31.6899561, 35.1779363],
    # just marking Bethlehem
    "Bir 'Unah": [31.7053812, 35.1921428],
    "al-Bweirah": [31.5467473, 35.1104559],
    "al-Hijrah": [31.4885061, 35.0444603],
    "Wadi Abu al-Hindy": [31.7577555, 35.3131817],
    "al-Mazra'ah al-Qibliyah": [31.9516001,35.1404423],
    "Kh. Iqteit": [31.4053983, 34.9132193],
    "a-Zuweidin": [31.4469374, 35.1988167],
    "al-Mufaqarah": [31.4097184, 35.1578761],
    "'Ein a-Duyuk al-Foqa": [31.8824595, 35.4312116],
    "Jub a-Dib": [31.6629264, 35.2473139],
    "a-Sawahrah a-Sharqiyah": [31.7506432,35.2509378],
    "al-Fawar R.C.": [31.4790643, 35.0454356],
    "al-Kasarat": [31.8077029, 35.3061095],
    "Kh. a-Safai al-Foqa": [31.3977216, 35.1783056],
    "'Atarah": [32.0005973, 35.1926885],
    "'Arab al-'Anani wa al-Jabour": [31.8595085, 35.1825176],
    "'Arab al-Freijat": [31.3572668,34.9092823],
    "a-Rifa'iya": [31.4488982, 35.1465109],
    "Ras al-Jorah": [31.599432, 35.0267391],
    "Kh.Ibziq": [32.3788375, 35.3913618],
    "Kh. al-Markez": [31.3630985, 35.1480249],
    "'Arab a-Ramadin al-Janubi": [32.1757289, 34.9860522],
    "Kh. 'Einun": [32.301211,35.4018731],
    "Badu a-Mu'arrajat": [31.9125193, 35.3329536],
    "Kh. Lasefar": [31.3629771, 35.1117337],
    "Khallet al-Mayah": [31.4457978, 35.1330566],
    "'Arab a-Rashayidah": [31.5695086, 35.1909612],
    "Kh. Iqtit": [31.4053983, 34.9132193],
    "Kh. Humsah": [32.2215216, 35.4771789],
    "al-Khas": [31.72452, 35.2384581],
    "'Asirah a-Shamaliyah": [32.2518341, 35.2578713],
    "'Ein al-Meyteh": [32.3276627, 35.4591785],
    "Abu a-Nuwar": [31.7593656, 35.2982859],
    "al-Karmel": [31.4066299, 35.0870239],
    "'Araba": [32.4032751, 35.1956143],
    "al-Mukasar": [32.208288,35.4502371],
    "a-Sheikh Sa'ed": [31.7386491, 35.2222173],
    "Kh. Qusah": [31.443244, 35.2213541],
    "Masafer Yatta": [31.3911489, 35.1618511],
    "Bir al-Maskub B": [31.8026947, 35.3140749],
    "al-Burj (Tubas)": [32.3289042, 35.455594],
    "al-Khalediah": [31.4441491, 35.0798053],
    "a-Simiya": [31.4216226, 34.9944962],
    "a-Zar'i (Za’atrah)": [31.802337, 35.2707251],
    "Shebtin": [31.9742901, 35.0402583],
    "Ras 'Ein al-'Auja": [31.9452532, 35.3897969],
    "Kh. Jenbah": [31.3650973, 35.1352856],
    "al-Farisiyah": [32.3420381, 35.5083406],
    "Kh. a-Nahlah": [31.6780452, 35.180027],
    "Maghayir al-'Abid": [31.4062559, 35.175089],
    "Ras 'Ein al-'Aujah": [31.9452532, 35.3897969],
    "Abu al-Hilu": [31.8118224, 35.3367641],
    "Abu Ghalyah": [31.8127784, 35.3016315],
    "al-Ka'abneh": [31.8255369, 35.2729748],
    "Kh. Ghuwein al-Foqa": [31.3609442, 35.077105],
    "Wadi Esneisel": [31.8022928, 35.3040313],
    "al-Fuqarah": [31.811602, 35.2965033],
    "al-A'uja": [31.9480641, 35.4608643],
    "a-Duqaiqah": [31.383396, 35.2199365],
    "Kh. 'Ein al-Hilweh": [32.3249738, 35.5015701],
    "Khashm a-Daraj": [31.4216425, 35.229873],
    "al-Hadidiyah": [32.2428235, 35.4888935],
    "Wadi al-Ghrus": [31.5331163, 35.0946997],
    "Kh. al-Halawah": [31.3741749, 35.1455531],
    "Kh. a-Tuba": [31.4062559, 35.172793],
    "Wadi al-Qatif": [31.8056623, 35.3932861],
    "Kh. Um Nir": [31.40304, 35.1123871],
    "Kh. 'Ein Karzaliyah": [32.111655, 35.4739811],
    "al-'Ajaj (Id'eis)": [32.118189,35.4941691],
    "Khallet al-Fouleh": [32.152561, 35.4708271],
    "Kh. Tall al-Himma": [32.3719597, 35.4959555],
    "Khashm al-Karem": [31.4100801, 35.2196703],
    "Bir al-Maskub A": [31.8025648, 35.3113466],
    "Kh.Jurat al-Kheil": [31.5927268, 35.1766262],
    # can't find, just placing in district (Hebron)
    "Kh. a-Razim": [31.5325681,35.0895263],
    "Kh.Um a-Rashash": [32.035521, 35.3630323],
    "Badu al-Mashru'": [31.8718225, 35.4901931],
    "Kh. al-Hafirah": [32.4061286, 35.2256165],
    "al-Khdeirat": [31.8573723, 35.2589552],
    "a-Sheikh 'Anbar (a-S'idi)": [31.7849203, 35.2461148],
    "Asfar": [31.581586, 35.1688511],
    "Ta'nak": [32.5209331, 35.2101193],
    "Khallet Makhul": [32.2702618, 35.4982756],
    "al-'Udeisah": [31.526173, 35.1397211],
    "Deir al-Quruntal": [31.868598, 35.4388261],
    "Far'on": [32.2854791, 35.0111813],
    # just placing in Nablus
    "Kh. Ja'waneh": [32.2293622, 35.211604],
    "Kh. Bir al-'Eid": [31.3745257, 35.1261722],
    "Kh. E'nizan": [31.3710628, 34.9930767],
    "al-Jab'ah": [31.6744661, 35.0666573],
    "Abu al-'Urqan": [31.4313811, 35.0115543],
    "'Arabunah": [32.5119031,35.3540103],
    "a-Lubban al-Gharbiyah": [32.0357751,35.0280653], 
    "al-'Ubeidiyah": [31.7238291, 35.2815213],
    "a-Zbeidat": [32.1743061, 35.5196583]

}
# Apply the functions row-wise
remaining_locations_to_fix['lat'] = remaining_locations_to_fix.apply(lambda row:  manual_adjustments[row['locality']][0] if row['locality'] in manual_adjustments else np.nan, axis = 1)

remaining_locations_to_fix['long'] = remaining_locations_to_fix.apply(lambda row:  manual_adjustments[row['locality']][1] if row['locality'] in manual_adjustments else np.nan, axis = 1)

# ---- combine -----

final_locations = pd.concat([
    locations[locations.match].merge(
        gdf[['pcbs_name', 'lat', 'long']], 
        how = 'left', 
        left_on = 'pcbs_match', 
        right_on = 'pcbs_name'
    ), 
     remaining_locations[
        ~(((remaining_locations.lat < 31.3)  | (remaining_locations.lat > 32.5)) | 
        ((remaining_locations.long < 34.9)  | (remaining_locations.long > 35.55)) | 
        (remaining_locations.lat_long == 'null'))
    ], 
    remaining_locations_to_fix
])

final_locations = final_locations[['locality', 'district', 'area', 'lat', 'long']]

df = df.merge(final_locations, 
    on = ['locality', 'district', 'area'], 
    how = 'left'
)

df = df[(df.lat.notna()) & (df.long.notna())]

# ---- save output -----

df.to_csv('../processed/demolitions.csv', index = False)
