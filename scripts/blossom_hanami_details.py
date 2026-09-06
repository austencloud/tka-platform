"""Garden-scale furnishings and planted edges for the Blossom Blender scene.

Consumes the builder's shared terrain, materials and exclusion functions. All
planting is deterministic and baked; no extra runtime asset request is needed.
"""
import math
import random
from types import SimpleNamespace


def create_hanami_details(builder):
    a = SimpleNamespace(**builder)
    rng = random.Random(20260905)

    def mesh_object(name, vertices, faces, materials, indices=None):
        mesh = a.make_mesh(name + ' Mesh', vertices, faces, materials, indices)
        a.add_planar_uv(mesh, metres_per_repeat=1.2)
        return a.link_object(name, mesh)

    # Low seats face the stage from behind the seated lawn. Gaps form aisles;
    # the east firm terrace remains open for wheelchair and companion positions.
    timber_v, timber_f, timber_i = [], [], []
    seat_footprints = []
    seats = [(-8.5,-23,3.2),(-4.7,-24.2,3.0),(4.7,-24.2,3.0),(8.5,-23,3.2),
             (-20.8,-16.5,2.4),(-20.8,-20.3,2.4),(22,-12,2.4),
             (12.8,34,2.6),(14.5,29.5,2.6)]
    for x,y,length in seats:
        # Reserve the whole seat and leg room, including between stations on a
        # curved walk. Search nearby only when a revised route crosses a seat.
        def clear_seat(sx,sy):
            angle=math.atan2(sx,-sy) if sy < 0 else -.65
            for ix in range(13):
                for iy in range(7):
                    lx=(ix/12-.5)*(length+.3)
                    ly=-.45+iy/6*1.5
                    px=sx+lx*math.cos(angle)-ly*math.sin(angle)
                    py=sy+lx*math.sin(angle)+ly*math.cos(angle)
                    if a.path_distance(px,py)<.25 or a.river_surface_distance(px,py)<1:return False
                    if any(zone.get('accessibleLayout') and a.point_in_polygon(px,py,zone['polygon']) for zone in a.MASTERPLAN['audience']['zones']):return False
                    if any(math.hypot(px-t['position'][0],py-t['position'][1])<t.get('trunkRadius',.6)+.3 for t in a.COMPOSITION_PLAN['trees']):return False
            return not any(math.hypot(sx-ox,sy-oy)<radius+length*.5+.3 for ox,oy,radius in seat_footprints)
        if not clear_seat(x,y):
            origin=(x,y)
            found=False
            for radius_step in range(1,17):
                for angle_step in range(24):
                    angle=angle_step*math.tau/24
                    sx=origin[0]+radius_step*.3*math.cos(angle)
                    sy=origin[1]+radius_step*.3*math.sin(angle)
                    if clear_seat(sx,sy):
                        x,y=sx,sy
                        found=True
                        break
                if found:break
            if not found:raise RuntimeError(f'No clear seat placement near {origin}')
        print(f'Hanami seat: ({x:.2f}, {y:.2f}), length {length}; route and leg room clear')
        yaw = math.atan2(x,-y) if y < 0 else -0.65
        z = a.garden_ground_height(x,y)
        seat_footprints.append((x,y,length*.55+.5))
        def box(local, size, mat):
            lx,ly,lz=local
            center=(x+lx*math.cos(yaw)-ly*math.sin(yaw),y+lx*math.sin(yaw)+ly*math.cos(yaw),z+lz)
            before=len(timber_f)
            a.append_box(timber_v,timber_f,center,size,(0,0,yaw))
            timber_i.extend([mat]*(len(timber_f)-before))
        for offset in (-.19,0,.19):
            box((0,offset,.46),(length,.17,.10),0)
        for offset in (-length*.36,length*.36):
            box((offset,0,.21),(.18,.48,.42),1)
        # A slight backrest and arms give older visitors a usable seat.
        box((0,-.31,.77),(length,.09,.13),0)
        for offset in (-length*.43,length*.43):
            box((offset,-.29,.61),(.09,.09,.47),1)
            box((offset,0,.65),(.10,.56,.09),0)
    seats_obj=mesh_object('Hanami_Timber_Seats',timber_v,timber_f,[a.CEDAR,a.CEDAR_DARK],timber_i)
    bevel=seats_obj.modifiers.new('Rounded seat edges','BEVEL')
    bevel.width=.018
    bevel.segments=2
    seats_obj['tka_seat_count']=len(seats)

    # Narrow timber slats screen storage on the service side without blocking
    # the emergency corridor or either entry into the backstage staging area.
    v,f=[],[]
    for y in [i*.28-5.5 for i in range(18)]:
        a.append_box(v,f,(15.2,y,a.garden_ground_height(15.2,y)+.85),(.10,.10,1.7))
    for z in (.38,1.35):
        a.append_box(v,f,(15.2,-3.1,z),(.14,5.0,.09))
    mesh_object('Hanami_Backstage_Screen',v,f,[a.CEDAR_DARK])

    # Paper lanterns hang between the near cherry trunks, outside the stage and
    # above walking headroom. Six ribbed shades share two materials and meshes.
    paper=a.material('Hanami warm paper',(1.0,.66,.39),roughness=.88,
                     emission=(1.0,.48,.16),emission_strength=.7)
    ribs=a.material('Hanami paper ribs',(.66,.29,.12),roughness=.92,
                    emission=(1.0,.40,.12),emission_strength=.22)
    v,f,indices=[],[],[]
    cord_v,cord_f=[],[]
    for start,end in (((-19,-3),(-17,-10)),((20,-4),(18,-7))):
        points=[]
        for step in range(25):
            u=step/24
            x=start[0]*(1-u)+end[0]*u
            y=start[1]*(1-u)+end[1]*u
            points.append((x,y,4.7-.55*math.sin(math.pi*u)))
        for first,second in zip(points,points[1:]):
            a.append_tapered_segment(cord_v,cord_f,first,second,.016,.016,sides=5)
        for u in (.24,.5,.76):
            x=start[0]*(1-u)+end[0]*u
            y=start[1]*(1-u)+end[1]*u
            top=4.7-.55*math.sin(math.pi*u)
            base=len(v)
            rings=((-0.02,.13),(-.1,.23),(-.23,.28),(-.39,.28),(-.53,.23),(-.61,.13))
            for z,radius in rings:
                for i in range(20):
                    angle=i*math.tau/20
                    v.append((x+math.cos(angle)*radius,y+math.sin(angle)*radius,top+z))
            for ring in range(len(rings)-1):
                for i in range(20):
                    j=(i+1)%20
                    f.append((base+ring*20+i,base+ring*20+j,base+(ring+1)*20+j,base+(ring+1)*20+i))
                    indices.append(1 if i%5==0 else 0)
            for z in (-.015,-.615):
                a.append_cylinder(cord_v,cord_f,(x,y,top+z),.14,.14,.045,sides=12)
    mesh_object('Hanami_Hanging_Lanterns',v,f,[paper,ribs],indices)
    mesh_object('Hanami_Lantern_Cords',cord_v,cord_f,[a.CEDAR_DARK])

    # Round the lacquer edges and give the lintel a continuous dark cap.
    gate=a.bpy.data.objects['Torii_Gate']
    bevel=gate.modifiers.new('Soft lacquer edges','BEVEL')
    bevel.width=.045
    bevel.segments=3
    x,y=a.MASTERPLAN['torii']['center']
    z=a.garden_ground_height(x,y)
    height=a.MASTERPLAN['torii']['height']
    width=a.MASTERPLAN['torii']['width']
    v,f=[],[]
    for i in range(24):
        lx=(i/23-.5)*width
        crown=height-.17+.24*(abs(lx)/(width*.5))**3
        a.append_box(v,f,(lx,0,crown),(width/23+.025,.64,.13))
    cap=mesh_object('Hanami_Torii_Lacquer_Cap',v,f,[a.TORII_DARK])
    cap.location=(x,y,z)
    cap.rotation_euler.z=math.radians(a.MASTERPLAN['torii']['rotationDegrees'])

    def planted(x,y,margin=.0):
        if a.path_distance(x,y)<.55+margin:return False
        if a.river_surface_distance(x,y)<.85+margin:return False
        if -10<x<16 and -10<y<7.5:return False
        if any(a.point_in_polygon(x,y,zone['polygon']) for zone in a.MASTERPLAN['audience']['zones']):return False
        if any(math.hypot(x-sx,y-sy)<r+margin for sx,sy,r in seat_footprints):return False
        for name in ('southLanding','northLanding'):
            r=a.MASTERPLAN['bridge'][name]
            if r['minX']-.8<x<r['maxX']+.8 and r['minY']-.8<y<r['maxY']+.8:return False
        if abs(x-a.MASTERPLAN['torii']['center'][0])<5 and abs(y-a.MASTERPLAN['torii']['center'][1])<3:return False
        if any(math.hypot(x-t['position'][0],y-t['position'][1])<1.0 for t in a.COMPOSITION_PLAN['trees']):return False
        if any(math.hypot(x-l['position'][0],y-l['position'][1])<1.15 for l in a.COMPOSITION_PLAN['lanterns']):return False
        return True

    # Native shared grass prototypes carry root-weight UVs into the existing
    # wind shader. Aggregate each palette to one draw, keeping device tiers.
    for palette in ('deep','living','damp'):
        tier='Base'
        prototype,_,_=a.make_grass_prototype(tier,palette,'bank' if palette=='damp' else 'grove',0,rng)
        vertices,faces,uvs=[],[],[]
        count=0
        for _ in range(16000):
            x,y=rng.uniform(-44,44),rng.uniform(-44,46)
            river=a.river_surface_distance(x,y)
            path=a.path_distance(x,y)
            nearest=min(math.hypot(x-t['position'][0],y-t['position'][1]) for t in a.COMPOSITION_PLAN['trees'])
            eligible=(.9<river<3.5) if palette=='damp' else (1.1<nearest<6.5) if palette=='deep' else (.6<path<2.7 or 4<nearest<8)
            patch=math.sin(x*.53+y*.24)+math.sin(y*.61-x*.17)
            if not eligible or patch < -.3 or not planted(x,y,.1):continue
            base=len(vertices)
            z=a.garden_ground_height(x,y)+.012
            yaw=rng.uniform(0,math.tau)
            scale=rng.uniform(.8,1.5)
            for vert in prototype.vertices:
                vx,vy,vz=vert.co
                vertices.append((x+scale*(vx*math.cos(yaw)-vy*math.sin(yaw)),y+scale*(vx*math.sin(yaw)+vy*math.cos(yaw)),z+vz*scale*(.8 if palette=='damp' else .55)))
            for poly in prototype.polygons:
                faces.append(tuple(base+idx for idx in poly.vertices))
                uvs.extend(tuple(prototype.uv_layers.active.data[li].uv) for li in poly.loop_indices)
            count+=1
            if count>=1900:break
        obj=mesh_object('Blossom_Grass_Base_'+palette.title()+'_Garden',vertices,faces,[a.GRASS_MATERIALS[palette]])
        uv=obj.data.uv_layers.active
        for i,value in enumerate(uvs):uv.data[i].uv=value
        obj['tka_ground_quality_tier']='base'
        obj['tka_ground_palette']=palette
        obj['tka_clumps']=count
        print(f'Hanami {palette}: {count} grass clumps')

    # Settled petals collect below actual crowns, with open paths and water.
    v,f,indices=[],[],[]
    for tree in a.COMPOSITION_PLAN['trees']:
        tx,ty,_=tree['position']
        for _ in range(200):
            angle=rng.uniform(0,math.tau)
            radius=math.sqrt(rng.random())*5.2
            x,y=tx+math.cos(angle)*radius,ty+math.sin(angle)*radius
            if not planted(x,y):continue
            z=a.garden_ground_height(x,y)+.025
            size=rng.uniform(.035,.09)
            start=len(v)
            v.extend([(x-size,y,z),(x,y-size*.5,z+.004),(x+size,y,z),(x,y+size*.6,z)])
            f.append((start,start+1,start+2,start+3))
            indices.append(rng.randrange(3))
    mesh_object('Hanami_Canopy_Petal_Drifts',v,f,[a.PETAL_IVORY,a.PETAL_BLUSH,a.PETAL_SHADOW],indices)
    print(f'Hanami furnishings: {len(seats)} seats; {len(f)} settled petals')
