import pandas as pd
import googlemaps
# import API key from uncommited file
from constants import google_maps_api_key
import geopandas as gpd


# ----- data read-in -----
df = pd.read_csv('../raw/demolitions.csv')

gdf = gpd.read_file('../raw/palestiniancommunities_wb_gs/PalestinianCommunities_WB_GS.shp')


# ----- functions -----

def clean_cols(df):
   df.columns  = [c.lower().replace(' ', '_') for c in df.columns]

   df['date_of_demolition'] = pd.to_datetime(df['date_of_demolition'], format='%Y-%m-%d')

   df['area'] = (
      df['area'].str.replace('-', ' ') \
        .str.replace('\s+', ' ', regex=True) \
            .str.strip() \
                .str.title()
   )

   df = df.rename(columns = {'type_of_sturcture': 'type_of_structure'})
   
   return df 

def get_lat_long(row):

    try:
        town = (
            row['locality'] + ' ' +
            row['district'] + ' ' +
            row['area']
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

# ---- processing -----

df = clean_cols(df)

# ---- geocoding ----

gmaps = googlemaps.Client(key=google_maps_api_key)

sample = df.sample(10)
sample['lat_long'] = sample.apply(get_lat_long, axis = 1)
sample['lat'] = sample.lat_long.str.split(',', expand=True)[0]
sample['long'] = sample.lat_long.str.split(',', expand=True)[1]
