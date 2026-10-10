/** Local polygon membership uses the existing geographic boundary data, including holes. */
export function contains(f:GeoJSON.Feature,lon:number,lat:number) {
 const g=f.geometry;if(g.type!=='Polygon'&&g.type!=='MultiPolygon')return false;
 const ring=(r:GeoJSON.Position[])=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [x,y]=r[i],[xx,yy]=r[j];if((y>lat)!==(yy>lat)&&lon<(xx-x)*(lat-y)/(yy-y)+x)yes=!yes}return yes};
 return (g.type==='Polygon'?[g.coordinates]:g.coordinates).some(rs=>ring(rs[0])&&!rs.slice(1).some(ring));
}
export function boundsOf(features:GeoJSON.Feature[]):[[number,number],[number,number]]|undefined {
 let w=180,e=-180,s=90,n=-90;
 for(const f of features){const g=f.geometry;if(g.type!=='Polygon'&&g.type!=='MultiPolygon')continue;for(const ring of g.type==='Polygon'?g.coordinates:g.coordinates.flat())for(const [x,y] of ring){w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,y);n=Math.max(n,y)}}
 return w<=e?[[w,s],[e,n]]:undefined;
}
