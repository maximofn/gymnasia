"""
Generate images for exercises and foods using Hugging Face Gradio API.

Supported backends (in order of preference):
  1. nano-banana   — Nano Banana 2 (multimodalart/nano-banana, HF PRO)
  2. z-image-turbo — Z-Image-Turbo (mrfakename/Z-Image-Turbo, free)
  3. flux2-dev     — FLUX.2-dev   (black-forest-labs/FLUX.2-dev, free)

Usage:
    uv run generate_images.py exercises                          # all exercises
    uv run generate_images.py exercises --id press-banca         # single exercise
    uv run generate_images.py foods                              # all foods
    uv run generate_images.py foods --id arroz-blanco            # single food
    uv run generate_images.py foods --id arroz-blanco --backend z-image-turbo

Requires HF_TOKEN in root .env file (Hugging Face PRO account for nano-banana).
"""

import json
import os
import sys
import shutil
import argparse
from pathlib import Path

from gradio_client import Client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

ROOT_DIR = Path(__file__).parent.parent
SCRIPT_DIR = Path(__file__).parent

MODEL = "Nano Banana 2"
RESOLUTION = "1K"

# ---------------------------------------------------------------------------
# Backend definitions
# ---------------------------------------------------------------------------

BACKENDS = ["nano-banana", "z-image-turbo", "flux2-dev"]

# ---------------------------------------------------------------------------
# Exercise config
# ---------------------------------------------------------------------------

EXERCISES_DIR = ROOT_DIR / "ejercicios"
EXERCISES_IMAGES_DIR = EXERCISES_DIR / "images"
EXERCISE_ASPECT_RATIO = "16:9"

EXERCISE_PROMPT_TEMPLATE = (
    "Minimal flat illustration of a {gender} performing {exercise_en}, {view}. "
    "Silhouette style with clean lines, dark charcoal background (#0D1117). "
    "The figure is outlined in soft lime green (#CBFF1A) with subtle glow effect. "
    "No face details, athletic body proportions. "
    "Simple gym environment, no text, no watermark. "
    "Modern fitness app aesthetic, clean composition with plenty of negative space. 16:9 aspect ratio."
)

# Map exercise id -> (english description, view angle)
EXERCISE_PROMPTS = {
    "v-up-alterno-banda": ("an alternating resistance-band V-up at peak contraction, torso lifted from the floor, one straight leg raised high and the other hovering low, both hands pulling a taut band looped around the raised foot", "side 3/4 view"),
    "rodillo-abdominal-asistido-banda": ("a kneeling assisted ab-wheel rollout near full extension, both hands gripping one ab wheel on the floor, one resistance band looped around the waist and stretching upward to a high anchor behind the athlete, spine neutral", "side 3/4 view"),
    "extension-cadera-inclinada-banda": ("a bent-over single-leg hip extension at peak contraction, one resistance band running from a low anchor behind the athlete to the raised ankle, support leg slightly bent, free leg extended straight backward and spine neutral", "side view"),
    "flexiones-agarre-cerrado-banda": ("a close-grip resistance-band push-up near the bottom, hands directly below the shoulders, elbows tight beside the ribs, body in one straight line, one long band stretched across the upper back with its ends pinned under both palms", "side 3/4 view"),
    "elevacion-frontal-lateral-banda": ("a standing resistance-band diagonal front-lateral raise at shoulder height, both feet pinning the band center, arms nearly straight and raised forward and outward halfway between a front raise and lateral raise", "front 3/4 view"),
    "sit-up-navaja-banda": ("a resistance-band jackknife sit-up at peak V position, torso and both straight legs lifted, both hands reaching toward the feet while holding a taut band looped around both arches", "side 3/4 view"),
    "crunch-giratorio-arrodillado-banda": ("a kneeling twisting resistance-band crunch at peak contraction, body angled beside one high anchor, both hands beside the head and torso flexed diagonally with the outer shoulder moving toward the opposite knee", "front 3/4 view"),
    "rotacion-interna-cadera-tumbado-banda": ("a supine bilateral hip internal rotation drill, hips and knees bent to ninety degrees above the torso, knees held together while both feet separate outward against one small loop band around the feet", "front 3/4 view"),
    "elevacion-piernas-rectas-banda": ("a supine straight-leg raise at the top, both legs together and vertical, one long resistance band looped around both arches with an end held in each hand beside the hips, lower back pressed to the floor", "side 3/4 view"),
    "curl-biceps-unilateral-sobre-cabeza-banda": ("a single-arm high-anchor resistance-band biceps curl at peak contraction, athlete standing sideways to the anchor, working upper arm horizontal at shoulder height and forearm curled toward the head, free arm relaxed", "front 3/4 view"),
    "sentadilla-dividida-unilateral-banda": ("a resistance-band Bulgarian split squat near the bottom, rear foot elevated on one bench, front foot pinning one end of a long band and same-side hand holding the other end at shoulder height, torso upright", "side 3/4 view"),
    "press-pecho-unilateral-giratorio-banda": ("a standing single-arm rotational resistance-band chest press at full extension, one band anchored behind at chest height, pressing arm reaching forward across the body while torso and rear heel rotate naturally", "front 3/4 view"),
    "remo-sentado-unilateral-giratorio-banda": ("a seated single-arm rotational resistance-band row at peak contraction, legs extended on the floor facing one low anchor, working elbow pulled behind the ribs while the torso rotates toward the pulling side", "front 3/4 view"),
    "pull-through-banda": ("a resistance-band pull-through at hip lockout, athlete standing with back to one low anchor, band passing between the legs and held by both hands in front of the hips, torso upright and glutes contracted", "side 3/4 view"),
    "sit-up-empuje-banda": ("a resistance-band push sit-up at the top, knees bent and feet planted, torso raised about forty-five degrees, both arms pressing straight forward against a band anchored on the floor behind the head", "side 3/4 view"),
    "curl-muneca-inverso-banda": ("a seated two-hand reverse wrist curl with resistance band at peak extension, forearms supported on the thighs, palms facing down and wrists hanging beyond the knees, band center pinned under both feet", "side 3/4 view"),
    "rotacion-interna-cadera-sentado-banda": ("a seated bilateral hip internal rotation drill on one flat bench, hips and knees bent ninety degrees, knees held together while both feet separate outward against one small loop band around the ankles", "front 3/4 view"),
    "giro-sentado-banda": ("a seated resistance-band torso rotation at the end range, athlete upright and perpendicular to one chest-height side anchor, both nearly straight arms holding the band together while the shoulders rotate away and hips remain square", "front 3/4 view"),
    "encogimientos-banda": ("a standing resistance-band shrug at peak elevation, both feet pinning the band center, one end held in each hand beside the thighs with straight arms, shoulders lifted vertically toward the ears", "front 3/4 view"),
    "extension-triceps-lateral-banda": ("a standing single-arm lateral triceps extension at lockout, both upper arms raised horizontally at shoulder height, one hand anchoring a resistance band near the chest while the working arm extends straight outward to the side", "front view"),
    "flexion-lateral-45-grados": ("a 45-degree side bend on one Roman-chair hyperextension bench, body positioned sideways with feet secured and outer hip on the pad, torso laterally lowered toward the floor, hands behind the head, no torso rotation", "side view"),
    "rodillo-abdominal-barra": ("a kneeling barbell rollout near full extension, both hands gripping one straight barbell on the floor at shoulder width, arms reaching forward, hips extended and spine neutral", "side 3/4 view"),
    "salto-estrella-sentadilla": ("an explosive squat star jump at the airborne peak, both feet clearly off the floor with legs spread wide and arms extended horizontally, torso upright", "front view"),
    "crunch-bicicleta-banda": ("a resistance-band bicycle crunch, lying supine with one loop band around both feet, one knee drawn toward the opposite elbow while the other leg extends straight against tension", "side 3/4 view"),
    "jalon-agarre-cerrado-banda": ("a close-grip resistance-band pulldown at peak contraction, seated upright facing one high anchor, both hands together near the upper chest and elbows pulled beside the ribs", "front 3/4 view"),
    "curl-concentrado-banda": ("a seated single-arm resistance-band concentration curl at peak contraction, band pinned beneath the same-side foot, working elbow braced against the inner thigh and free hand on the other knee", "side 3/4 view"),
    "elevacion-frontal-banda": ("a standing two-arm resistance-band front raise at shoulder height, both feet pinning the band center, arms nearly straight and parallel to the floor, palms down", "front 3/4 view"),
    "puente-gluteos-banda": ("a glute bridge at the top position with one small loop resistance band just above both knees, feet planted, hips fully raised and knees pressing outward", "side 3/4 view"),
    "remo-unilateral-bajo-banda": ("a standing single-arm low-anchor resistance-band row at peak contraction, torso hinged slightly forward, working elbow pulled toward the hip and opposite hand free", "side 3/4 view"),
    "press-hombros-banda": ("a standing resistance-band shoulder press at overhead lockout, both feet pinning the band center, one end in each hand, arms straight above the shoulders and torso braced", "front 3/4 view"),
    "sentadilla-dividida-banda": ("a resistance-band split squat near the bottom, long band pinned beneath the front foot with both ends held at shoulder height, rear knee hovering above the floor and torso upright", "side 3/4 view"),
    "step-up-banda": ("a step-up near the top on one stable plyometric box, one small loop resistance band above both knees, lead foot planted on the box and trailing leg lifted behind", "side 3/4 view"),
    "press-pallof-vertical-banda": ("a vertical Pallof press with the body perpendicular to one side anchor, both hands pressing a resistance band diagonally overhead while the torso remains square and resists rotation", "front 3/4 view"),
    "elevacion-y-banda": ("a standing resistance-band Y-raise at the top position, both feet pinning the band center and both nearly straight arms extended overhead and outward to form a clear letter-free Y silhouette", "front 3/4 view"),
    "sentadilla-salto-barra": ("a light-barbell jump squat at the airborne peak, one barbell secured across the upper back, both feet clearly off the floor, hips and knees extended and hands holding the bar", "front 3/4 view"),
    "zancada-lateral-barra": ("a barbell lateral lunge near the bottom, bar secured across the upper back, one knee deeply bent with hip pushed back while the opposite leg stays straight and both feet face forward", "front 3/4 view"),
    "curl-predicador-barra": ("a barbell preacher curl at peak contraction on one preacher bench, upper arms fully supported on the angled pad, palms-up grip and bar close to the shoulders", "side 3/4 view"),
    "encogimientos-barra": ("a standing barbell shrug at peak elevation, one barbell held against the front of the thighs with straight arms, shoulders lifted vertically toward the ears and torso upright", "front 3/4 view"),
    "elevacion-gemelos-sentado-barra": ("a seated barbell calf raise at the top position, barbell resting across both thighs near the knees, balls of both feet on one low block and heels raised high", "side 3/4 view"),
    "extension-triceps-barra-pie": ("a standing overhead barbell triceps extension at the lowered position, one straight bar held behind the head, elbows bent and pointing upward close to the ears, torso braced", "side 3/4 view"),
    "sit-up-tres-cuartos": ("a three-quarter sit-up at the top position, lying on the floor with knees bent and feet planted, torso curled about 45 degrees above the floor, hands lightly behind the head", "side 3/4 view"),
    "jalon-lateral-alterno-polea": ("an alternating dual-handle high-cable pulldown, seated upright, one elbow pulled down beside the ribs while the opposite arm remains extended overhead", "front 3/4 view"),
    "dominada-arquero": ("an archer pull-up at the top on a single straight bar, chest shifted toward one bent arm while the opposite arm stays nearly straight along the bar", "front view"),
    "fondos-pecho-asistidos": ("an assisted chest dip near the bottom on a kneeling counterweight machine, knees supported on one moving pad, torso leaning slightly forward, elbows bent near 90 degrees", "side 3/4 view"),
    "hiperextension-fitball": ("a back extension on one stability ball at the top position, hips and abdomen supported on the ball, feet braced against one low wall support, body straight from heels to head", "side view"),
    "back-lever": ("a strict back lever hold on a single pull-up bar, arms straight behind the torso, face toward the floor, entire body horizontal and parallel to the ground with legs together", "side view"),
    "equilibrio-tabla": ("a single-leg balance hold on one small wobble board, supporting knee softly bent, opposite foot lifted, torso upright and arms out for balance", "front 3/4 view"),
    "curl-biceps-alterno-banda": ("an alternating standing resistance-band biceps curl, both feet pinning the center of one band, one palm-up hand curled near the shoulder while the other arm stays extended", "front 3/4 view"),
    "dominadas-asistidas-banda": ("a band-assisted pull-up at the top position, one loop band anchored around a straight pull-up bar and supporting one bent knee, chin above the bar", "front 3/4 view"),
    "press-banca-banda": ("a resistance-band bench press near full extension, lying on one flat bench, one band routed securely beneath the bench with one end in each hand above the chest", "side 3/4 view"),
    "jalon-unilateral-arrodillado-banda": ("a half-kneeling single-arm resistance-band pulldown at peak contraction, band anchored high overhead, working elbow pulled beside the ribs while torso stays upright", "front 3/4 view"),
    "aperturas-inversas-banda": ("a standing resistance-band reverse fly at peak contraction, holding one band at chest height with arms opened wide and nearly straight, shoulder blades retracted", "front 3/4 view"),
    "sentadilla-banda": ("a bodyweight squat at the bottom with one small loop resistance band just above both knees, thighs near parallel, knees pressed outward and chest upright", "front 3/4 view"),
    "peso-muerto-piernas-rigidas-banda": ("a resistance-band stiff-leg deadlift near the bottom, both feet standing on one long band, hands holding its ends close to the shins, hips hinged back and spine neutral", "side 3/4 view"),
    "clean-and-press-barra": ("a barbell clean and press at the final overhead lockout, feet shoulder-width, hips and knees extended, straight bar centered above the shoulders after a clean", "front 3/4 view"),
    "curl-arrastre-barra": ("a standing barbell drag curl at peak contraction, palms-up grip, bar sliding close against the torso near the lower chest, elbows pulled behind the body", "side 3/4 view"),
    "sentadilla-hack-barra": ("a traditional barbell hack squat at the starting lockout, holding one barbell behind the legs just below the glutes, torso upright, arms straight and feet shoulder-width", "side 3/4 view"),
    "sentadilla-jefferson-barra": ("a Jefferson squat near the bottom, athlete straddling one barbell diagonally between staggered feet, one hand gripping in front and the other behind the body, torso upright", "front 3/4 view"),
    "arrancada-una-mano-barra": ("a one-arm barbell snatch at stable overhead lockout, exactly one hand gripping the center of one horizontal barbell, arm straight, feet planted and free arm extended for balance", "front 3/4 view"),
    "sentadilla-overhead-barra": ("an overhead barbell squat at the bottom position, wide grip with arms fully locked, bar directly above mid-foot, hips below parallel and chest upright", "front 3/4 view"),
    "zancada-barra": ("a forward barbell lunge at the bottom position, bar resting across the upper back, front knee near 90 degrees, rear knee hovering above the floor, torso upright", "side 3/4 view"),
    "rack-pull-barra": ("a barbell rack pull at lockout inside a power rack, bar held against the thighs, support pins just below knee height, hips and knees extended, spine neutral", "front 3/4 view"),
    "thruster-barra": ("a barbell thruster at the overhead lockout immediately after a front squat, feet shoulder-width, hips and knees extended, bar directly above the shoulders", "front 3/4 view"),
    "cuerdas-batalla": ("alternating battle rope waves in an athletic half-squat stance, one thick rope end in each hand, alternating arms creating two clear waves toward one floor anchor", "front 3/4 view"),
    "pull-through-polea": ("a cable rope pull-through at full hip extension, standing with back to one low pulley, rope passing between the legs, arms straight, glutes contracted and torso upright", "side 3/4 view"),
    "crunch-rodillas-polea": ("a kneeling high-cable rope crunch at peak contraction, facing the pulley, rope held beside the head, hips fixed and spine curled so elbows move toward the thighs", "side 3/4 view"),
    "press-pallof-banda": ("a standing Pallof press with both arms fully extended at chest height, body perpendicular to a waist-high resistance band anchor, torso resisting rotation", "front 3/4 view"),
    "rotacion-landmine-180": ("a landmine 180 rotation with both hands holding the free barbell end beside one hip, opposite bar end anchored to the floor, torso rotated and feet pivoting", "front 3/4 view"),
    "sentadilla-sissy": ("a supported bodyweight sissy squat near the bottom, heels raised, knees driven forward, torso leaning backward in a straight line from knees to shoulders, one hand lightly holding a vertical support", "side view"),
    "curl-femoral-inverso-banco": ("a Nordic inverse leg curl midway through the forward lowering phase, kneeling with ankles secured under one low bench, body straight from knees to head, arms ready to catch", "side 3/4 view"),
    "puente-gluteos-marcha": ("a glute bridge march, lying supine with hips held high, one foot planted and the opposite knee lifted toward the chest, pelvis level and arms flat on the floor", "side 3/4 view"),
    "elevacion-piernas-banco-plano": ("a straight-leg raise on one flat bench near the top, lying supine and gripping the bench edges, both legs together and raised nearly vertical, lower back supported", "side 3/4 view"),
    "flexion-arquero": ("an archer push-up at the bottom on one side, hands placed very wide, chest shifted over the bent working elbow while the opposite arm stays nearly straight, body rigid", "front 3/4 view"),
    "flexion-con-palmada": ("an explosive clap push-up at the airborne moment, rigid plank body fully above the floor, both hands together clapping below the chest before landing", "side 3/4 view"),
    "dominadas-agarre-neutro": ("a neutral-grip pull-up at the top position on two parallel overhead handles, palms facing each other, chin above hand level, elbows pulled down and legs hanging still", "front 3/4 view"),
    "remo-pendlay-barra": ("a Pendlay barbell row at peak pull, torso parallel to the floor, spine neutral, bar touching the lower chest, elbows driven back, knees softly bent", "side 3/4 view"),
    "press-pecho-sentado-polea": ("a seated dual-cable chest press near full extension, upright on one bench between two pulleys behind the shoulders, one handle in each hand pressed forward at chest height", "front 3/4 view"),
    "press-hombros-polea": ("a standing dual-cable shoulder press near overhead lockout, back to two low pulleys, one handle in each hand, cables rising behind the forearms, torso braced", "front 3/4 view"),
    "curl-martillo-cuerda-polea": ("a standing low-cable rope hammer curl at peak contraction, neutral grip with palms facing each other, rope ends near the shoulders and elbows pinned beside the torso", "front 3/4 view"),
    "jalon-triceps-agarre-inverso": ("a high-cable reverse-grip triceps pushdown at full extension, straight bar held with palms up, elbows pinned beside the torso and bar near the thighs", "front 3/4 view"),
    "rodillo-abdominal": ("a kneeling ab wheel rollout near full extension, hands gripping one small ab wheel, arms reaching forward, hips extended, spine neutral and body hovering above the floor", "side 3/4 view"),
    "sit-up-declinado": ("a decline sit-up near the top position on a declined bench, feet securely anchored at the raised end, knees bent, torso curled toward the thighs, arms crossed over chest", "side view"),
    "elevacion-rodillas-oblicua-colgado": ("a hanging oblique knee raise at peak contraction, hanging from a pull-up bar with both knees lifted together toward one side of the chest, pelvis rotated without swinging", "front 3/4 view"),
    "bear-crawl": ("a bear crawl in motion, hands and toes on the floor, knees hovering a few centimeters above the ground, back flat, opposite hand and foot stepping forward", "side 3/4 view"),
    "sentadilla-con-salto": ("a bodyweight jump squat at peak airborne extension, both feet clearly off the floor, hips and knees extended, arms naturally counterbalancing", "front 3/4 view"),
    "paseo-granjero": ("a farmer's walk in mid-stride, torso upright and shoulders stable, one heavy dumbbell hanging from each straight arm beside the thighs", "front 3/4 view"),
    "sentadilla-hack-maquina": ("a hack squat at the bottom position in a 45-degree sled machine, back and shoulders against the pads, feet on the platform, knees deeply bent and aligned with toes", "side 3/4 view"),
    "abduccion-cadera-maquina": ("a seated hip abduction machine at the open position, back against the pad, knees bent at 90 degrees and pressing the outer thigh pads wide apart", "front 3/4 view"),
    "aduccion-cadera-maquina": ("a seated hip adduction machine at peak contraction, back against the pad, knees bent at 90 degrees and inner thigh pads brought together", "front 3/4 view"),
    "hiperextension-lumbar": ("a bodyweight back hyperextension on a 45-degree Roman chair, ankles secured and hips on the pad, body in one straight line at the top, arms crossed over chest", "side view"),
    "press-inclinado-mancuernas": ("an incline dumbbell bench press near lockout on a 30-degree bench, one dumbbell in each hand above the upper chest, shoulder blades supported and feet planted", "side 3/4 view"),
    "flexiones-declinadas": ("a decline push-up near the bottom position, both feet elevated together on one low bench, hands on the floor, body straight from head to heels, chest close to the ground", "side 3/4 view"),
    "jalon-brazos-rectos-polea": ("a standing straight-arm cable pulldown at the bottom position, facing a high pulley, torso slightly hinged, elbows nearly locked, straight bar held against the upper thighs", "side 3/4 view"),
    "remo-t-maquina": ("a chest-supported T-bar row machine at peak contraction, chest against the pad, feet braced, both handles pulled toward the lower ribs and shoulder blades retracted", "front 3/4 view"),
    "elevacion-lateral-polea": ("a single-arm cable lateral raise at shoulder height, standing side-on to one low pulley, far hand holding the handle across the front of the body, torso still", "front 3/4 view"),
    "aperturas-inversas-maquina": ("a reverse pec deck machine fly at peak contraction, seated facing the chest pad, arms opened wide at shoulder height with soft elbows and shoulder blades retracted", "rear 3/4 view"),
    "curl-inverso-barra": ("a standing barbell reverse curl near the top position, shoulder-width overhand grip with palms down, wrists straight and elbows pinned beside the torso", "front 3/4 view"),
    "curl-muneca-barra": ("a seated palms-up barbell wrist curl, forearms fully supported on a flat bench, wrists extending just beyond the edge and flexed upward while elbows stay fixed", "side 3/4 view"),
    "fondos-en-banco": ("a bodyweight bench dip at the bottom position, hands gripping one bench behind the hips, knees bent and feet planted, elbows bent backward near 90 degrees, back close to the bench", "side 3/4 view"),
    "extension-triceps-polea-sobre-cabeza": ("a standing rope overhead cable triceps extension near full extension, facing away from one high pulley with a staggered stance, upper arms beside the ears and rope ends separated above and forward", "side 3/4 view"),
    "crunch-bicicleta": ("a bicycle crunch lying supine, one elbow moving toward the opposite bent knee while the other leg extends straight and low, shoulders lifted, lower back stable", "side 3/4 view"),
    "toques-talon-alternos": ("alternating heel touches lying supine with knees bent and feet planted, shoulders lifted, torso side-bent so one hand reaches the same-side heel", "slightly elevated front 3/4 view"),
    "crunch-inverso": ("a reverse crunch at peak contraction, lying supine with knees bent toward the chest and hips curled visibly off the floor, arms flat beside the torso", "side 3/4 view"),
    "plancha-lateral": ("a strict forearm side plank, elbow under shoulder, feet stacked, hips elevated, body forming one straight line from head to heels, free arm vertical", "front 3/4 view"),
    "saltar-comba": ("jumping rope in midair with both feet together just above the floor, elbows close to the torso, wrists turning one rope in a complete visible loop", "front 3/4 view"),
    "saltos-patinador": ("a skater hop at the landing position on one leg, hips back and knee flexed, trailing leg crossing behind without weight, opposite arm reaching naturally", "front 3/4 view"),
    "saltos-estrella": ("a star jump at peak height, both arms extended diagonally upward and both legs spread wide, full body forming a clear five-point star", "front view"),
    "peso-muerto-rumano-mancuernas": ("a dumbbell Romanian deadlift at the bottom of a controlled hip hinge, hips pushed back, knees softly bent, spine neutral, two dumbbells close to the shins", "side 3/4 view"),
    "peso-muerto-una-pierna-mancuerna": ("a single-leg dumbbell deadlift at the bottom position, standing leg softly bent, torso and free leg nearly horizontal, one dumbbell reaching toward the floor in the opposite hand, hips square", "side view"),
    "elevacion-gluteo-isquios": ("a glute-ham raise on a compact GHD machine, knees supported and ankles secured, whole body straight from knees to head at the high position, arms crossed over chest", "side view"),
    "zancadas-caminando": ("a bodyweight walking lunge at the bottom of one forward step, both knees near 90 degrees, rear knee hovering above the floor, torso upright and arms in natural running counterbalance", "side 3/4 view"),
    "press-inclinado-barra": ("an incline barbell bench press on a 45-degree bench, bar lowered above the upper chest, forearms vertical, feet planted, shoulders supported", "side 3/4 view"),
    "aperturas-inversas-polea": ("a bent-over cable reverse fly at peak contraction between two low pulleys, arms opened wide at shoulder height with slight elbow bend, shoulder blades retracted", "rear 3/4 view"),
    "press-declinado-barra": ("a decline barbell bench press, head lower than hips and legs secured, bar lowered above the lower chest, forearms vertical", "side 3/4 view"),
    "remo-menton-barra": ("a standing barbell upright row at the top position, bar close to the upper chest, elbows high and clearly above the hands, torso vertical", "front 3/4 view"),
    "aperturas-polea-pie": ("a standing cable chest fly at peak contraction between two chest-height pulleys, staggered stance, both handles meeting in front of the sternum, elbows softly bent", "front 3/4 view"),
    "curl-inclinado-mancuernas": ("an incline dumbbell biceps curl seated against an inclined backrest, both upper arms hanging behind the torso and fixed, palms supinated, dumbbells near the shoulders", "front 3/4 view"),
    "curl-biceps-polea": ("a standing low-cable biceps curl at peak contraction, straight bar near the shoulders, palms up, elbows pinned beside the torso", "front 3/4 view"),
    "press-banca-agarre-cerrado": ("a close-grip barbell bench press on a flat bench, bar just above the lower chest, hands slightly narrower than shoulder width, elbows tucked close to the torso", "side 3/4 view"),
    "extension-triceps-sentado-mancuerna": ("a seated two-hand overhead dumbbell triceps extension at the bottom position, upper arms vertical beside the ears, elbows bent, one dumbbell lowered behind the head", "side 3/4 view"),
    "sentadilla-frontal-barra": ("a barbell front squat at the bottom position, bar resting across the front shoulders in a clean rack, elbows high, chest upright, thighs below parallel, feet shoulder-width", "3/4 diagonal view"),
    "buenos-dias-barra": ("a standing barbell good morning at the bottom of a controlled hip hinge, bar across the upper back, hips pushed far back, knees softly bent, spine neutral, torso almost horizontal", "side view"),
    "peso-muerto-sumo-barra": ("a sumo barbell deadlift at mid-pull, very wide stance with toes turned outward, hands gripping the bar between the knees, chest high, hips and knees extending", "3/4 diagonal view"),
    "sentadilla-goblet-mancuerna": ("a deep goblet squat holding one dumbbell vertically against the chest with both hands, elbows inside the knees, chest upright, feet shoulder-width", "3/4 diagonal view"),
    "sentadilla-bulgara-mancuernas": ("a Bulgarian split squat at the bottom position, rear foot elevated on a simple bench, front knee near 90 degrees, upright torso, one dumbbell in each hand", "side view"),
    "step-up-mancuernas": ("a dumbbell step-up midway onto a sturdy knee-height box, entire lead foot planted, driving through that leg, trailing foot lifted, torso upright, one dumbbell in each hand", "3/4 diagonal view"),
    "remo-unilateral-mancuerna": ("a one-arm dumbbell row at the top position with one hand and the same-side knee supported on a flat bench, back neutral, working elbow pulled toward the hip", "3/4 diagonal view"),
    "pullover-mancuerna": ("a dumbbell pullover lying lengthwise on a flat bench, both hands holding one dumbbell behind the head, arms nearly straight with a slight elbow bend, feet planted", "side view"),
    "dominadas-supinas": ("a chin-up at the top position on a straight overhead bar, shoulder-width underhand grip with palms facing the athlete, chin clearly above the bar, legs hanging still", "front 3/4 view"),
    "remo-invertido": ("an inverted bodyweight row under a waist-high fixed bar at the top position, overhand grip, chest close to the bar, body straight from shoulders to heels, heels on the floor", "side view"),
    "press-militar-barra-sentado": ("a seated barbell military press at mid-press, seated upright against one bench backrest, bar directly above the forehead, forearms vertical, feet planted", "3/4 diagonal view"),
    "encogimientos-mancuernas": ("a standing dumbbell shrug at peak contraction, shoulders elevated straight toward the ears, arms fully extended at the sides, one dumbbell in each hand, no elbow bend", "front 3/4 view"),
    "curl-martillo-mancuernas": ("a standing dumbbell hammer curl at peak contraction, neutral grip with palms facing each other, elbows pinned beside the torso, one dumbbell in each hand", "3/4 diagonal view"),
    "extension-triceps-tumbado-barra": ("a lying barbell triceps extension on a flat bench at the bottom position, upper arms vertical and fixed, elbows bent, straight bar hovering safely just above the forehead", "side 3/4 view"),
    "patada-triceps-mancuernas": ("a two-arm dumbbell triceps kickback at full extension, torso hinged forward with neutral spine, upper arms fixed alongside the ribs, both forearms extended straight behind", "3/4 diagonal view"),
    "flexiones-diamante": ("a diamond push-up at the lower position, hands close together directly under the chest with thumbs and index fingers forming a clear diamond, elbows tucked, body in a straight plank", "side 3/4 view"),
    "elevaciones-piernas-colgado": ("a hanging straight-leg raise on an overhead pull-up bar, both arms straight, legs together and lifted horizontally in front at hip height, torso still with no swing", "side view"),
    "giro-ruso": ("a bodyweight Russian twist seated on the floor, torso reclined, feet lifted together, knees bent, both hands clasped and rotated beside one hip while the knees stay centered", "front 3/4 view"),
    "escalador": ("a dynamic mountain climber in a high plank, both hands planted under the shoulders, one knee driven tightly toward the chest, opposite leg fully extended, hips low", "side view"),
    "dead-bug": ("a dead bug exercise lying supine on the floor, one arm extended overhead and the opposite leg extended low above the floor, other arm vertical and other hip and knee bent 90 degrees", "side 3/4 view"),
    "peso-muerto-barra": ("a conventional barbell deadlift at mid-pull, feet hip-width apart, both hands gripping the bar just outside the legs, bar close to the shins, neutral spine, hips and knees extending together", "3/4 diagonal view"),
    "peso-muerto-rumano-barra": ("a standing barbell Romanian deadlift at the bottom of the hip hinge, hips pushed far back, knees slightly bent, neutral spine, bar held close to the lower legs, hamstrings under tension", "side view"),
    "remo-inclinado-barra": ("a standing bent-over barbell row at the top position, torso hinged forward with a neutral spine, knees slightly bent, pulling the bar toward the lower chest with elbows behind the body", "3/4 diagonal view"),
    "curl-biceps-barra": ("a standing barbell biceps curl at peak contraction, elbows fixed close to the torso, underhand grip, bar near shoulder height, no body swing", "3/4 diagonal view"),
    "zancadas-mancuernas": ("a forward dumbbell lunge at the bottom position, one dumbbell in each hand at the sides, front knee bent about 90 degrees, rear knee close to the floor, torso upright", "3/4 diagonal view"),
    "press-arnold-mancuernas": ("a seated Arnold dumbbell press on a bench with back support, dumbbells at shoulder level, elbows forward, palms rotating outward while pressing overhead", "3/4 diagonal view"),
    "swing-pesa-rusa": ("a two-handed kettlebell swing driven by a powerful hip hinge, kettlebell floating at chest height, arms straight and relaxed, knees slightly bent, neutral spine", "side view"),
    "fondos-paralelas": ("a chest-focused bodyweight dip on parallel bars at the lower position, torso leaning slightly forward, elbows bent, shoulders just below elbow height, feet suspended", "3/4 diagonal view"),
    "puente-gluteos-barra": ("a barbell glute bridge on the floor at full hip extension, upper back and shoulders on the floor, knees bent, feet planted, padded barbell held securely across the hips", "side view"),
    "burpee": ("the floor transition of a burpee, both hands planted shoulder-width apart, torso in a straight plank, both legs dynamically extending backward from a crouch", "side view"),
    "press-banca": ("a barbell bench press lying on a flat bench", "3/4 diagonal view"),
    "press-mancuernas": ("a dumbbell bench press lying on a flat bench, one dumbbell in each hand", "3/4 diagonal view"),
    "aperturas-mancuernas": ("dumbbell chest flyes lying on a flat bench, arms open wide with slight elbow bend", "3/4 diagonal view"),
    "aperturas-inclinadas-mancuernas": ("incline dumbbell chest flyes lying on an incline bench at 30-45 degrees, arms open wide with slight elbow bend", "3/4 diagonal view"),
    "press-unilateral-maquina": ("a seated single-arm chest press on a machine, pushing forward with one arm", "3/4 diagonal view"),
    "extensiones-triceps-cuerda": ("a standing tricep rope pushdown on a cable machine, arms pushing down", "3/4 diagonal view"),
    "jalon-unilateral-maquina": ("a seated single-arm plate-loaded lat pulldown machine with converging lever arms, pulling one handle down with one arm, no cables no bar", "3/4 diagonal view"),
    "remo-unilateral-maquina": ("a seated single-arm plate-loaded row machine, chest supported, pulling one handle back with one arm bringing the elbow close to the body, no cables", "3/4 diagonal view"),
    "jalon-poleas": ("a seated cable lat pulldown, pulling a wide bar down to the upper chest with both hands on a cable pulley machine, thighs locked under pads", "3/4 diagonal view"),
    "remo-polea": ("a seated cable row on a low pulley machine, feet on platform, pulling a handle toward the abdomen with both hands, back straight", "3/4 diagonal view"),
    "remo-cuello-polea-baja": ("a standing face pull on a low cable pulley, pulling a rope upward toward the neck with elbows high and wide, targeting rear deltoids", "3/4 diagonal view"),
    "curl-mancuernas-sentado": ("a seated incline dumbbell bicep curl, sitting on an incline bench with back supported, curling both dumbbells up toward the shoulders simultaneously", "3/4 diagonal view"),
    "curl-concentrado": ("a seated concentration curl, sitting on a bench with legs apart, elbow braced against inner thigh, curling a dumbbell up with one arm", "3/4 diagonal view"),
    "curl-scott": ("a preacher curl on a Scott bench, seated with the back of the upper arms resting on the angled preacher pad, holding an EZ curl bar with both hands in an underhand grip, curling the bar up toward the shoulders", "3/4 diagonal view"),
    "sentadilla-barra": ("a barbell back squat, standing with a barbell on the upper back behind the neck, squatting down with thighs parallel to the floor, feet shoulder width apart", "3/4 diagonal view"),
    "prensa-inclinada": ("a 45-degree incline leg press machine, seated with back against pad, pushing a weighted platform upward with both legs, knees bent at 90 degrees", "3/4 diagonal view"),
    "prensa-horizontal": ("a horizontal seated leg press machine, sitting upright pushing a vertical platform forward with both legs, knees bent at 90 degrees", "3/4 diagonal view"),
    "prensa-vertical": ("a vertical leg press machine with metal frame and guide rails, person lying on back on the base pad inside the machine frame, pushing a plate-loaded platform vertically upward with both feet along guide rails", "3/4 diagonal view"),
    "femoral-de-pie": ("a standing single-leg hamstring curl machine, standing upright with chest leaning on pad, curling one leg back bringing heel toward glute against a roller pad", "3/4 diagonal view from behind"),
    "femoral-tumbado": ("a prone lying leg curl machine, lying face down on a bench curling both heels toward glutes against a roller pad, gripping front handles", "side view"),
    "femoral-sentado": ("person sitting on a machine seat in a gym, torso upright, thighs flat on the seat, but the knees are bent sharply so the feet go DOWN and BACK with the soles of the feet facing the wall behind the chair, the calves are pressed against a round roller pad under the seat near the floor", "side view close-up"),
    "press-inclinado-unilateral-maquina": ("a seated single-arm incline chest press on a machine, pushing upward and forward with one arm on an inclined trajectory", "3/4 diagonal view"),
    "extensiones-triceps-barra": ("a standing tricep straight bar pushdown on a cable machine, gripping a straight bar pushing down", "3/4 diagonal view"),
    "gemelos-sentado": ("a seated calf raise machine, person sitting with a pad on top of the knees, feet on a platform with heels hanging off the edge, raising the heels upward by contracting the calves", "3/4 diagonal view"),
    "gemelos-de-pie": ("a standing calf raise machine, person standing upright with shoulder pads pressing down on the shoulders, toes on a platform with heels hanging off the edge, rising up on tiptoes by contracting the calves", "3/4 diagonal view from behind"),
    "gemelos-prensa": ("a calf press on a 45-degree leg press machine, person lying back on the inclined seat with legs almost fully extended, only the toes and balls of the feet on the bottom edge of the platform, pushing the platform by pointing the toes and extending the ankles", "side view"),
    "press-hombro-mancuernas": ("a seated dumbbell shoulder press, sitting on a bench with back support, pressing two dumbbells overhead with arms extended above the head, palms facing forward", "3/4 diagonal view"),
    "press-hombro-unilateral-maquina": ("a seated single-arm overhead shoulder press on a plate-loaded machine, sitting with back against pad, pushing one handle upward above the head with one arm, the other arm resting", "3/4 diagonal view"),
    "elevaciones-laterales-mancuernas": ("a standing dumbbell lateral raise, standing upright holding a dumbbell in each hand, arms raised out to the sides at shoulder height forming a T shape, slight bend in the elbows", "front view"),
    "elevaciones-frontales-mancuernas": ("a standing dumbbell front raise, standing upright holding a dumbbell in each hand, one arm raised straight forward to shoulder height in front of the body, palms facing down", "3/4 diagonal view"),
    "crunch-abdominales": ("a crunch exercise lying on the floor, knees bent with feet flat on the ground, hands behind the head, upper back and shoulders lifted off the floor contracting the abs", "side view"),
    "extension-cuadriceps": ("a seated leg extension machine, person sitting upright with back against the pad, ankles hooked behind a roller pad, legs extended forward and upward contracting the quadriceps", "side view"),
    "gemelos-prensa-horizontal": ("a calf press on a horizontal seated leg press machine, person sitting upright with legs almost fully extended, only the toes and balls of the feet on the edge of the vertical platform, pushing the platform by pointing the toes and extending the ankles to contract the calves", "side view"),
    "elevaciones-frontales-barra": ("a standing barbell front raise, standing upright holding a barbell with both hands at hip level with an overhand grip, arms raised straight forward to shoulder height in front of the body", "3/4 diagonal view"),
    "pajaro-mancuernas": ("a bent-over dumbbell reverse fly, standing with torso bent forward nearly parallel to the floor, knees slightly bent, holding a dumbbell in each hand with arms raised out to the sides at shoulder height, squeezing the shoulder blades together", "3/4 diagonal view"),
    "flexiones": ("a push-up on the floor, body straight from head to heels in plank position, arms extended pushing the body up from the ground, hands shoulder-width apart", "side view"),
    "dominadas": ("a pull-up hanging from a horizontal fixed bar overhead, gripping the bar with both hands in an overhand pronated grip slightly wider than shoulder-width, body pulled up until the chin is above the bar, arms bent, legs hanging straight", "front view"),
}

# ---------------------------------------------------------------------------
# Food config
# ---------------------------------------------------------------------------

FOODS_DIR = ROOT_DIR / "alimentos"
FOODS_IMAGES_DIR = FOODS_DIR / "images"
FOOD_ASPECT_RATIO = "1:1"

FOOD_PROMPT_TEMPLATE = (
    "{food_description}. "
    "Centered on a dark charcoal background (#0D1117). "
    "Clean studio food photography style, single subject, no plate clutter. "
    "Soft top-down warm lighting with subtle shadow. "
    "Vibrant, appetizing colors, high contrast against dark background. "
    "No text, no watermark, no hands, no utensils. "
    "Minimal composition, plenty of negative space. "
    "Optimized for small thumbnail display: bold shapes, clear silhouette, easily recognizable at 48x48px. "
    "Square 1:1 aspect ratio."
)

# Map food id -> english description (visually specific for small thumbnails)
FOOD_PROMPTS = {
    "aceite-girasol": "a small glass bottle of pale golden sunflower oil with a bright yellow sunflower beside it",
    "aceite-oliva": "a small glass bottle of golden-green extra virgin olive oil with a thin stream pouring",
    "aguacate": "a ripe avocado cut in half showing the green flesh and brown pit",
    "almendras": "a handful of whole raw almonds with brown skin, scattered loosely",
    "arroz-basmati": "a small bowl of cooked basmati rice, long slender separated grains with a slightly golden hue",
    "arroz-blanco": "a small bowl of cooked white rice, fluffy separated grains",
    "arroz-integral": "a small bowl of cooked brown rice, slightly nutty-looking grains",
    "atun": "a fresh raw tuna steak, deep red-pink flesh with clean cut",
    "atun-lata": "an open tin can of tuna in water, flaky light-pink chunks visible from above",
    "avena": "a small bowl of dry rolled oats, golden flakes",
    "boniato": "a baked sweet potato cut open showing bright orange flesh",
    "brocoli": "a single fresh broccoli floret, vibrant deep green",
    "claras-huevo": "a carton bottle of liquid egg whites pouring a stream of translucent glossy egg whites into the void",
    "espinacas": "a bunch of fresh baby spinach leaves, bright green and tender",
    "garbanzos": "a small bowl of cooked chickpeas, round beige-golden legumes",
    "huevo": "a whole brown egg next to a fried egg with bright yellow yolk",
    "leche-entera": "a glass of whole white milk, creamy and opaque",
    "leche-semidesnatada": "a glass of whole white milk, creamy and opaque",
    "leche-desnatada": "a glass of whole white milk, creamy and opaque",
    "lentejas": "a small bowl of cooked brown-green lentils, earthy and rustic",
    "manzana": "a single shiny red apple with a small green leaf on the stem",
    "nueces": "a few shelled walnut halves showing the wrinkled brain-like shape",
    "pan-integral": "a slice of whole wheat bread, dense texture with visible grain specks",
    "pasta": "a small portion of cooked spaghetti pasta twirled into a neat nest",
    "patata": "a boiled potato cut in half, smooth creamy-yellow interior",
    "pechuga-pavo": "a sliced grilled turkey breast fillet, lean white meat with grill marks",
    "pechuga-pollo": "a grilled chicken breast fillet, golden-brown sear marks on white meat",
    "platano": "a single ripe yellow banana with a few brown spots",
    "queso-fresco": "a wedge of fresh white cheese, soft and moist with a clean cut",
    "salmon": "a raw salmon fillet, vibrant orange-pink flesh with white fat lines",
    "slim-pasta-fettuccine": "a small nest of translucent glossy white konjac shirataki fettuccine noodles, flat wet ribbons",
    "tomate": "a single ripe red tomato with green stem, glossy skin",
    "yogur-griego": "a small bowl of thick creamy white Greek yogurt with a smooth surface",
}


# ---------------------------------------------------------------------------
# Shared generation logic
# ---------------------------------------------------------------------------

def get_hf_token() -> str:
    token = os.environ.get("HF_TOKEN", "")
    if not token:
        print("Error: set HF_TOKEN in image-generation/.env")
        sys.exit(1)
    return token


def connect_backend(backend: str, token: str) -> tuple[Client, str]:
    """Connect to a Gradio backend. Returns (client, backend_name)."""
    if backend == "nano-banana":
        print("Connecting to Nano Banana 2...")
        client = Client("multimodalart/nano-banana", token=token)
        ep = client.endpoints[2]
        ep.is_valid = True
        return client, backend
    elif backend == "z-image-turbo":
        print("Connecting to Z-Image-Turbo...")
        client = Client("mrfakename/Z-Image-Turbo")
        return client, backend
    elif backend == "flux2-dev":
        print("Connecting to FLUX.2-dev...")
        client = Client("black-forest-labs/FLUX.2-dev")
        return client, backend
    else:
        print(f"Error: unknown backend '{backend}'")
        sys.exit(1)


def connect_with_fallback(backend: str | None, token: str) -> tuple[Client, str]:
    """Try the requested backend, fall back through the list on failure."""
    if backend:
        try:
            return connect_backend(backend, token)
        except Exception as e:
            print(f"  Failed to connect to {backend}: {e}")
            sys.exit(1)

    # Auto mode: try each backend in order
    for b in BACKENDS:
        try:
            return connect_backend(b, token)
        except Exception as e:
            print(f"  Failed to connect to {b}: {e}")
            continue

    print("Error: all backends unavailable.")
    sys.exit(1)


def _predict_nano_banana(client: Client, token: str, prompt: str, aspect_ratio: str):
    """Call Nano Banana 2 predict."""
    return client.predict(
        prompt,
        None,           # gallery
        aspect_ratio,
        MODEL,
        RESOLUTION,
        token,          # manual token field
        fn_index=2,
    )


def _predict_z_image_turbo(client: Client, prompt: str):
    """Call Z-Image-Turbo predict."""
    return client.predict(
        prompt=prompt,
        height=1024,
        width=1024,
        num_inference_steps=9,
        seed=42,
        randomize_seed=True,
        api_name="/generate_image",
    )


def _predict_flux2_dev(client: Client, prompt: str):
    """Call FLUX.2-dev predict."""
    return client.predict(
        prompt=prompt,
        input_images=[],
        seed=0,
        randomize_seed=True,
        width=1024,
        height=1024,
        num_inference_steps=30,
        guidance_scale=4,
        prompt_upsampling=True,
        api_name="/infer",
    )


def _extract_image_path(result) -> str | None:
    """Extract a local file path from various Gradio result formats."""
    # Simple string path (nano-banana)
    if isinstance(result, str):
        return result
    # Tuple of (image_info, seed) — z-image-turbo & flux2-dev
    if isinstance(result, (list, tuple)) and len(result) >= 1:
        item = result[0]
        if isinstance(item, str):
            return item
        if isinstance(item, dict) and item.get("path"):
            return item["path"]
    # Single dict
    if isinstance(result, dict) and result.get("path"):
        return result["path"]
    return None


def generate_image(client: Client, backend: str, token: str, prompt: str, output_path: Path, aspect_ratio: str) -> None:
    if output_path.exists():
        print(f"  Skipping (already exists): {output_path.name}")
        return

    print(f"  Generating: {output_path.name}  [backend: {backend}]")
    print(f"  Prompt: {prompt[:120]}...")

    if backend == "nano-banana":
        result = _predict_nano_banana(client, token, prompt, aspect_ratio)
    elif backend == "z-image-turbo":
        result = _predict_z_image_turbo(client, prompt)
    elif backend == "flux2-dev":
        result = _predict_flux2_dev(client, prompt)
    else:
        print(f"  Error: unknown backend '{backend}'")
        return

    image_path = _extract_image_path(result)
    if image_path:
        shutil.copy(image_path, str(output_path))
        print(f"  Saved: {output_path.name}")
    else:
        print(f"  Warning: unexpected result: {result}")


# ---------------------------------------------------------------------------
# Exercise generation
# ---------------------------------------------------------------------------

def generate_exercises(client: Client, backend: str, token: str, exercise_id: str | None):
    EXERCISES_IMAGES_DIR.mkdir(exist_ok=True)

    json_files = sorted(EXERCISES_DIR.glob("*.json"))
    json_files = [f for f in json_files if f.name not in ("package.json", "index.json", "all.json")]

    if not json_files:
        print("No exercise JSON files found.")
        return

    for json_path in json_files:
        with open(json_path) as f:
            exercise = json.load(f)

        eid = exercise["id"]

        if exercise_id and eid != exercise_id:
            continue

        if eid not in EXERCISE_PROMPTS:
            print(f"Skipping {eid}: no prompt mapping defined in EXERCISE_PROMPTS")
            continue

        exercise_en, view = EXERCISE_PROMPTS[eid]
        print(f"\n{'='*50}")
        print(f"Exercise: {exercise['name']} ({eid})")
        print(f"{'='*50}")

        for gender, label in [("man", "male"), ("woman", "female")]:
            prompt = EXERCISE_PROMPT_TEMPLATE.format(
                gender=gender,
                exercise_en=exercise_en,
                view=view,
            )
            output_path = EXERCISES_IMAGES_DIR / f"{eid}-{label}.webp"
            generate_image(client, backend, token, prompt, output_path, EXERCISE_ASPECT_RATIO)

    # Rebuild all.json and index.json
    all_exercises = []
    all_ids = []
    for jp in sorted(EXERCISES_DIR.glob("*.json")):
        if jp.name in ("package.json", "index.json", "all.json"):
            continue
        with open(jp) as f:
            all_exercises.append(json.load(f))
        all_ids.append(jp.stem)

    with open(EXERCISES_DIR / "all.json", "w") as f:
        json.dump(all_exercises, f, indent=2, ensure_ascii=False)
    with open(EXERCISES_DIR / "index.json", "w") as f:
        json.dump(all_ids, f, ensure_ascii=False)
    print(f"\nUpdated all.json ({len(all_exercises)} exercises) and index.json")


# ---------------------------------------------------------------------------
# Food generation
# ---------------------------------------------------------------------------

def generate_foods(client: Client, backend: str, token: str, food_id: str | None):
    FOODS_IMAGES_DIR.mkdir(exist_ok=True)

    json_files = sorted(FOODS_DIR.glob("*.json"))
    json_files = [f for f in json_files if f.name not in ("package.json", "index.json", "all.json")]

    if not json_files:
        print("No food JSON files found.")
        return

    for json_path in json_files:
        with open(json_path) as f:
            food = json.load(f)

        fid = food["id"]

        if food_id and fid != food_id:
            continue

        if fid not in FOOD_PROMPTS:
            print(f"Skipping {fid}: no prompt mapping defined in FOOD_PROMPTS")
            continue

        food_description = FOOD_PROMPTS[fid]
        print(f"\n{'='*50}")
        print(f"Food: {food['name']} ({fid})")
        print(f"{'='*50}")

        prompt = FOOD_PROMPT_TEMPLATE.format(food_description=food_description)
        output_path = FOODS_IMAGES_DIR / f"{fid}.webp"
        generate_image(client, backend, token, prompt, output_path, FOOD_ASPECT_RATIO)

    # Rebuild all.json and index.json
    all_foods = []
    all_index = []
    for jp in sorted(FOODS_DIR.glob("*.json")):
        if jp.name in ("package.json", "index.json", "all.json"):
            continue
        with open(jp) as f:
            all_foods.append(json.load(f))
        all_index.append({"id": jp.stem, "name": all_foods[-1]["name"]})

    with open(FOODS_DIR / "all.json", "w") as f:
        json.dump(all_foods, f, indent=2, ensure_ascii=False)
    with open(FOODS_DIR / "index.json", "w") as f:
        json.dump(all_index, f, indent=2, ensure_ascii=False)
    print(f"\nUpdated all.json ({len(all_foods)} foods) and index.json")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate images for exercises or foods")
    parser.add_argument(
        "--backend",
        type=str,
        choices=BACKENDS,
        default=None,
        help="Backend to use (default: auto-detect with fallback)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    ex_parser = subparsers.add_parser("exercises", help="Generate exercise images")
    ex_parser.add_argument("--id", type=str, help="Generate only for this exercise id")

    food_parser = subparsers.add_parser("foods", help="Generate food images")
    food_parser.add_argument("--id", type=str, help="Generate only for this food id")

    args = parser.parse_args()

    token = get_hf_token()
    client, backend = connect_with_fallback(args.backend, token)
    print(f"Using backend: {backend}")

    if args.command == "exercises":
        generate_exercises(client, backend, token, args.id)
    elif args.command == "foods":
        generate_foods(client, backend, token, args.id)

    print("\nDone!")


if __name__ == "__main__":
    main()
