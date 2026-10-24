"""Rebuild the pinned exhibit from a downloaded source file. See data/exhibits/README.md."""
import sys
import openpyxl,json,hashlib
from pathlib import Path
w=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)
result={}
for name in ['Medium variant','Low variant','High variant']:
 s=w[name];s.reset_dimensions();rows=s.iter_rows(min_row=17,values_only=True);heads=next(rows);ix={x:i for i,x in enumerate(heads)}
 points=[]
 for r in rows:
  if r[2] in ['Africa','China','India'] and isinstance(r[10],(int,float)) and 2024<=r[10]<=2100:
   points.append({'region':r[2],'year':int(r[10]),'children':round(r[ix['0-14']]/1000,3),'working':round(r[ix['15-64']]/1000,3),'older':round(r[ix['65+']]/1000,3)})
 result[name.split()[0].lower()]=points
 print(name,len(points),flush=True)
result={'source':'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/EXCEL_FILES/2_Population/WPP2024_POP_F03_1_POPULATION_SELECT_AGE_GROUPS_BOTH_SEXES.xlsx','edition':'UN World Population Prospects 2024','unit':'millions of people','retrieved':'2026-10-24','sourceSha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'license':'CC BY 3.0 IGO','variants':result}
Path('data/exhibits/population.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
