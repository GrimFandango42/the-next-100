"""Rebuild the pinned exhibit from a downloaded source file. See data/exhibits/README.md."""
import sys
import csv,json,urllib.request,base64,hashlib
from pathlib import Path
rows=list(csv.DictReader(Path(sys.argv[1]).read_text().splitlines(),skipinitialspace=True))
result={'source':'https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v4.0.csv','edition':'NSIDC Sea Ice Index v4.0','retrieved':'2026-10-24','unit':'million km²','measure':'September monthly mean Arctic sea-ice extent','points':[[int(r['year']),float(r['extent'])] for r in rows]}
Path('data/exhibits/arctic.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
Path('public/evidence').mkdir(exist_ok=True)
for year in [1979,2000,2012,2026]:
 u=f'https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/images/09_Sep/N_{year}09_extn_v4.0.png'
 b=urllib.request.urlopen(u,timeout=30).read()
 assert b[:8]==b'\x89PNG\r\n\x1a\n'
 # Preserve the source image byte-for-byte inside an SVG image container.
 import struct
 width,height=struct.unpack('>II',b[16:24])
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><title>NSIDC September {year} Arctic sea ice extent</title><image width="{width}" height="{height}" href="data:image/png;base64,{base64.b64encode(b).decode()}"/></svg>'
 Path(f'public/evidence/arctic-{year}.svg').write_text(svg)
 print(year,len(b),flush=True)
