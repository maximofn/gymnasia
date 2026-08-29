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
    "press-hombros-alterno-mancuernas": ("a standing alternating dumbbell shoulder press with exactly two dumbbells, one arm fully pressed overhead while the opposite dumbbell remains fixed at shoulder height, feet shoulder-width and torso upright without side bending", "front 3/4 view"),
    "curl-biceps-alterno-fitball-pierna-elevada": ("an alternating dumbbell biceps curl while seated upright on one stability ball with one foot planted and the opposite leg lifted straight forward, exactly two dumbbells with one arm curled and the other extended, ball and torso completely steady", "front 3/4 view"),
    "curl-biceps-alterno-sentado-fitball": ("an alternating dumbbell biceps curl seated upright on one stability ball, both feet planted wide, exactly two dumbbells with one palm-up forearm curled toward the shoulder while the other arm hangs extended", "front 3/4 view"),
    "press-arnold-mancuernas-v2": ("a seated Arnold dumbbell press at the top position on one upright-back bench, exactly two dumbbells overhead with arms nearly extended and palms facing forward, showing controlled shoulder rotation from the elbows-forward start", "front 3/4 view"),
    "pullover-circular-mancuerna": ("a circular around-the-head dumbbell pullover while lying face-up on one flat bench, exactly one dumbbell held securely with both hands traveling through a wide side arc beside and behind the head, elbows softly bent and feet planted", "slightly elevated side 3/4 view"),
    "press-banca-mancuernas": ("a flat dumbbell bench press at the controlled bottom position, athlete lying on one flat bench with feet planted, exactly two dumbbells beside the mid-chest, forearms vertical and elbows bent slightly below bench level", "front 3/4 view"),
    "press-hombros-sentado-banco-mancuernas": ("a two-arm seated dumbbell overhead press on one flat bench with no backrest, athlete sitting tall with feet planted and exactly two dumbbells pressed above the shoulders, torso unsupported and ribs controlled", "front 3/4 view"),
    "sentadilla-banco-mancuernas": ("a dumbbell bench squat at the light-touch bottom position, athlete standing just in front of one flat bench with exactly two dumbbells hanging beside the thighs, hips touching the bench without sitting, feet flat and knees tracking over toes", "side 3/4 view"),
    "remo-inclinado-mancuernas": ("a bent-over two-dumbbell row at peak contraction, torso hinged nearly parallel to the floor with neutral spine and soft knees, exactly two dumbbells pulled toward the lower ribs with elbows behind the torso", "front 3/4 view"),
    "curl-biceps-zancada-gesto-bolos-mancuernas": ("a dumbbell biceps-curl lunge with bowling motion at the rotated bottom position, athlete in one deep forward lunge holding exactly two dumbbells, torso rotated toward the front leg, same-side arm extended forward and opposite arm extended backward like a controlled bowling follow-through", "front 3/4 view"),
    "curl-biceps-fitball-pierna-elevada": ("a simultaneous two-dumbbell biceps curl while seated on one stability ball with one foot planted and the opposite leg lifted straight forward, both forearms curled toward the shoulders, elbows tucked and torso perfectly upright", "front 3/4 view"),
    "curl-biceps-postura-ciguena-mancuerna": ("a single-leg stork-stance dumbbell biceps curl, athlete balanced on one softly bent leg with torso hinged forward and the free leg extended straight behind, exactly one dumbbell curled beneath the shoulder while hips remain square", "side 3/4 view"),
    "curl-biceps-mancuernas-de-pie": ("a strict standing bilateral dumbbell biceps curl at peak contraction, exactly two dumbbells held with palms up near the shoulders, elbows pinned beside the torso, feet shoulder-width and body upright without swinging", "front 3/4 view"),
    "curl-biceps-mancuernas-arm-blaster": ("a strict standing bilateral dumbbell biceps curl using exactly one metal arm-blaster plate across the upper abdomen, exactly two dumbbells curled simultaneously with palms up and both upper arms braced against the plate", "front 3/4 view"),
    "curl-biceps-inverso-mancuernas": ("a standing bilateral reverse dumbbell biceps curl at peak contraction, exactly two dumbbells at shoulder height with palms facing down and wrists straight, elbows fixed close to the torso", "front 3/4 view"),
    "sentadilla-curl-biceps-mancuernas": ("a combined dumbbell squat and biceps curl captured just after standing, exactly two dumbbells curled toward the shoulders with palms up, feet in squat stance and knees softly extended, torso tall without swinging", "front 3/4 view"),
    "curl-biceps-v-sit-bosu-mancuernas": ("a dumbbell biceps curl in a balanced V-sit on exactly one BOSU dome, hips centered on the dome, torso leaned slightly back, both feet lifted with knees bent, exactly two dumbbells curled toward the shoulders while the core holds the V position", "front 3/4 view"),
    "burpee-mancuernas": ("a dumbbell burpee captured in the low push-up phase, athlete in one rigid plank gripping exactly two hex dumbbells planted shoulder-width on the floor, chest lowered between them and feet extended back, clearly showing the weighted burpee setup", "side 3/4 view"),
    "clean-mancuernas": ("a two-dumbbell clean at the catch position, athlete standing with softly bent knees and hips, exactly two dumbbells racked at shoulder height close to the body, elbows pointing forward and feet shoulder-width", "front 3/4 view"),
    "press-banca-agarre-cerrado-mancuernas": ("a close-grip dumbbell bench press at the controlled bottom position, athlete lying on one flat bench with feet planted, exactly two dumbbells nearly touching over the lower chest in neutral grip and elbows tucked tightly beside the ribs", "front 3/4 view"),
    "remo-de-pie-peso-corporal": ("a standing bodyweight row at peak contraction using one fixed chest-height horizontal rail, athlete leaning backward in one rigid line with feet planted, both hands in a shoulder-width overhand grip and both elbows pulled behind the torso as the chest approaches the rail", "front 3/4 view"),
    "remo-de-pie-toalla-peso-corporal": ("a standing bodyweight towel row at peak contraction using exactly one towel looped around one fixed chest-height post, athlete leaning backward in one rigid line with feet planted, one towel end in each hand and both elbows pulled beside the ribs", "side 3/4 view"),
    "bottoms-up-tumbado": ("a lying bottoms-up reverse abdominal curl at the top position, athlete supine with both arms flat beside the torso, legs together and raised nearly vertical above the hips, knees softly bent and pelvis curled just off the floor without swinging the legs overhead", "slightly elevated side 3/4 view"),
    "butt-up-plancha-antebrazos": ("a forearm-plank butt-up at the peak pike position, both forearms planted with elbows under shoulders, legs straight on the toes and hips lifted high into a controlled inverted V while the back stays neutral", "side view"),
    "curl-nordico-asistido-polea-banco": ("a cable-assisted inverse Nordic leg curl during the controlled forward lean, athlete kneeling on one flat bench with shins secured under a rear pad, body rigid from knees through head, both hands holding one high-cable handle close to the upper chest for assistance", "side 3/4 view"),
    "jalon-lateral-barra-polea": ("a seated cable bar lateral pulldown at peak contraction, athlete secured at one high-pulley station, hands slightly wider than shoulders on one wide straight lat bar, chest lifted and elbows driven down as the bar reaches the upper chest", "front 3/4 view"),
    "cruce-pectorales-polea-altura-pecho": ("a standing mid-height cable crossover at peak chest contraction between two cable towers, one handle in each hand, stable staggered stance, elbows softly bent and both hands meeting directly in front of the sternum", "front view"),
    "remo-amplio-sentado-suelo-polea": ("a floor-seated wide-grip cable row at peak contraction, athlete sitting upright facing one low pulley with legs extended comfortably, both hands wide on one long straight bar and elbows pulled back as the bar reaches the lower chest", "front 3/4 view"),
    "elevacion-frontal-unilateral-polea": ("a single-arm cable forward raise at shoulder height, athlete standing tall facing one low pulley, one hand holding a single D-handle with the working arm nearly straight in front and the free arm relaxed beside the torso", "front 3/4 view"),
    "elevacion-frontal-unilateral-polea-v2": ("a strict one-arm cable front shoulder raise at the top position, athlete one step in front of one low pulley with a quiet upright torso, one D-handle lifted directly to shoulder height with a soft elbow and the opposite arm resting at the side", "side 3/4 view"),
    "extension-triceps-sobre-cabeza-barra-polea-alta": ("a high-pulley overhead triceps extension with one short straight bar, athlete facing away from the cable tower in a stable split stance, upper arms fixed beside the ears and elbows nearly extended as the bar moves forward above the head", "side 3/4 view"),
    "aperturas-inclinadas-fitball-polea": ("an incline cable chest fly on one stability ball at peak contraction, upper back and shoulders supported on the ball, hips lifted in a firm bridge, feet planted wide, one low-cable handle in each hand meeting above the upper chest with elbows softly bent", "front 3/4 view"),
    "jalon-inclinado-banco-polea": ("a cable incline pushdown for the lats at peak contraction, athlete lying face-up on one incline bench with head nearest one high pulley, both hands on one straight bar, arms nearly straight as the bar sweeps in a wide arc down toward the upper thighs", "side view"),
    "elevacion-gemelos-burro": ("a bodyweight donkey calf raise at peak contraction, athlete hinged deeply at the hips with forearms supported on one flat bench, balls of both feet on one low step, legs mostly straight and both heels lifted as high as possible", "side 3/4 view"),
    "flexion-profunda-dos-bancos": ("a deep deficit push-up at the bottom position between exactly two parallel low benches, one hand planted on each bench edge, chest lowered below hand level between the supports and body held in one rigid plank from head through heels", "slightly elevated side 3/4 view"),
    "curl-biceps-alterno-mancuernas": ("a standing alternating dumbbell biceps curl, athlete holding exactly two dumbbells with one supinated arm curled to shoulder height while the opposite arm remains extended beside the thigh, elbows fixed close to the torso", "front 3/4 view"),
    "curl-biceps-alterno-mancuernas-arm-blaster": ("a standing alternating dumbbell biceps curl using one metal arm blaster across the upper abdomen, exactly two dumbbells with one arm curled and the other extended, both upper arms braced firmly against the arm-blaster wings", "front 3/4 view"),
    "curl-martillo-alterno-predicador-mancuernas": ("an alternating hammer preacher curl at peak contraction on one preacher bench, athlete seated with both upper arms supported on the sloped pad, exactly two dumbbells held in neutral grips, one forearm curled upright and the other arm extended", "front 3/4 view"),
    "curl-biceps-alterno-predicador-mancuernas": ("an alternating supinated dumbbell preacher curl on one preacher bench, athlete seated with both upper arms fixed on the sloped pad, exactly two dumbbells, one palm-up forearm curled toward the shoulder while the other arm remains extended", "front 3/4 view"),
    "curl-martillo-alterno-sentado-mancuernas": ("a seated alternating dumbbell hammer curl on one flat bench, athlete upright with exactly two dumbbells in neutral grips, one forearm curled toward the shoulder while the other arm hangs extended and both elbows stay beside the torso", "front 3/4 view"),
    "sentadilla-amplia-barra": ("a wide-stance barbell back squat at the bottom position, one barbell across the upper traps, feet much wider than shoulders with toes turned slightly outward, thighs near parallel, knees tracking over toes and torso upright", "front 3/4 view"),
    "curl-muneca-barra-sentado": ("a seated palms-up barbell wrist curl at peak contraction, forearms braced on both thighs and elbows still, one light straight barbell held at the fingertips then curled upward only through the wrists", "side 3/4 view"),
    "curl-muneca-barra-sentado-v2": ("a seated supinated barbell wrist curl at the raised position, forearms resting along the thighs with wrists extending beyond the knees, one light straight barbell lifted by wrist flexion while the forearms remain fixed", "front 3/4 view"),
    "sentadilla-zercher-barra-v2": ("a barbell Zercher squat at the controlled bottom position, one straight barbell secured in the crooks of both elbows against the torso, hands together, feet shoulder-width, hips below parallel and chest tall", "side 3/4 view"),
    "fondo-banco-en-suelo": ("a bench triceps dip at the bottom position, both palms gripping the edge of one low flat bench behind the hips, torso close to the bench, elbows bent about 90 degrees, legs extended forward with heels planted on the floor", "side 3/4 view"),
    "dominadas-en-banco": ("a bench-height inverted bodyweight pull-up at peak contraction beneath one low fixed horizontal rail, athlete body rigid and nearly horizontal with heels on the floor, overhand grip wider than shoulders and chest pulled toward the rail", "side 3/4 view"),
    "curl-concentrado-biceps-con-pierna": ("a seated self-resisted biceps leg concentration curl at peak contraction, athlete on one flat bench with legs spread, working elbow braced inside one thigh and working hand hooked under the opposite thigh just above the knee, lifting that relaxed leg by elbow flexion", "front 3/4 view"),
    "dominada-supina-biceps-agarre-estrecho": ("a close-grip supinated chin-up at the top position on one overhead bar, palms facing the athlete, hands narrower than shoulders, elbows pulled down close to the ribs and chin clearly above the bar", "front 3/4 view"),
    "dominada-prona-biceps": ("a shoulder-width pronated pull-up at the top position on one overhead bar, palms facing away, elbows flexed down beside the torso, chest lifted and chin above the bar without swinging", "front 3/4 view"),
    "body-up-triceps": ("a body-up triceps press captured during the transition from forearms to palms, athlete in one rigid straight high-plank line on toes, both palms planted shoulder-width and elbows nearly extended as the torso rises from forearm support", "side 3/4 view"),
    "sentadilla-salto-pies-juntos": ("an explosive bodyweight drop jump squat captured airborne, torso upright, arms naturally counterbalancing, hips and knees extended, both feet drawn together beneath the body ready for a soft forefoot landing", "front 3/4 view"),
    "plancha-lateral-inclinada-peso-corporal": ("an incline side plank hold with one forearm supported on one low flat bench, elbow directly under shoulder, feet stacked on the floor, hips lifted and body forming one straight diagonal line from head through heels", "side view"),
    "extension-triceps-arrodillado-peso-corporal": ("a kneeling bodyweight triceps extension at the bottom position on the floor, both knees planted, body straight from knees through head, hands fixed shoulder-width ahead of the shoulders, elbows tucked and deeply bent with forearms close to the floor", "side 3/4 view"),
    "curl-biceps-tumbado-lateral-peso-corporal": ("a side-lying bodyweight biceps curl at peak contraction, athlete lying straight on one side with legs stacked, lower arm supporting the head, upper arm pinned along the torso and upper forearm curled toward the shoulder with a clenched empty hand", "front 3/4 view"),
    "remo-sentadilla-toalla": ("a bodyweight squatting row at peak contraction using exactly one towel looped around one fixed chest-height post, athlete leaning back in a deep squat with feet planted, both hands pulling the towel ends toward the ribs and shoulder blades retracted", "side 3/4 view"),
    "elevacion-gemelos-de-pie-peso-corporal": ("a standing bodyweight calf raise at peak contraction, feet hip-width and parallel, knees straight, both heels lifted high on the forefeet, torso upright and one hand lightly touching one fixed vertical support for balance", "side 3/4 view"),
    "remo-unilateral-agarre-cerrado-de-pie-peso-corporal": ("a standing close-grip one-arm bodyweight row at peak contraction using one fixed chest-height vertical post, athlete leaning backward in a rigid line with feet planted, one hand gripping the post and working elbow pulled tightly beside the ribs", "side 3/4 view"),
    "remo-agarre-cerrado-de-pie-peso-corporal": ("a standing bilateral close-grip bodyweight row at peak contraction using one fixed chest-height central handle, athlete leaning backward in a rigid line with feet planted, both hands close together and elbows tucked while the chest pulls toward the anchor", "front 3/4 view"),
    "remo-unilateral-de-pie-peso-corporal": ("a standing one-arm bodyweight row at peak contraction using one fixed chest-height horizontal rail, athlete leaning backward in a rigid line with feet planted, one hand gripping the rail and elbow drawing back slightly outward as the chest approaches the hand", "rear 3/4 view"),
    "remo-unilateral-de-pie-toalla": ("a standing one-arm bodyweight towel row at peak contraction, exactly one towel securely looped around one fixed chest-height post, athlete leaning backward in a rigid line with feet planted, one hand gripping both towel ends and elbow pulled behind the torso", "side 3/4 view"),
    "press-banca-agarre-cerrado-barra-v2": ("a close-grip flat barbell bench press at the bottom position inside one compact rack, athlete lying on one flat bench with feet planted, hands exactly shoulder-width on one barbell lowered to mid-chest and elbows tucked close to the ribs", "side 3/4 view"),
    "extension-triceps-tumbado-agarre-cerrado-barra": ("a close-grip lying barbell triceps extension at the bottom position on one flat bench, upper arms vertical and still, elbows bent tightly while one straight barbell hovers just above the forehead", "side view"),
    "extension-triceps-tumbado-barra-v2": ("a lying barbell skull crusher at the controlled bottom position on one flat bench, hands shoulder-width with overhand grip, upper arms fixed vertical and one straight barbell lowered toward the forehead", "side 3/4 view"),
    "curl-predicador-tumbado-barra": ("a prone lying preacher curl at peak contraction, athlete chest-down against the sloped face of one preacher bench, both upper arms fully supported over its top edge and curling one straight barbell toward the shoulders with palms up", "side 3/4 view"),
    "extension-triceps-tumbado-barra-v3": ("a lying barbell triceps extension with the bar lowered just behind the crown of the head, athlete face up on one flat bench, upper arms angled slightly backward and kept still while elbows remain close", "slightly elevated side 3/4 view"),
    "elevacion-deltoide-posterior-barra": ("a bent-over wide-grip barbell rear-delt high row at peak contraction, torso hinged almost parallel to the floor with neutral spine, one straight barbell pulled toward the upper chest and elbows flared wide at shoulder height", "rear 3/4 view"),
    "zancada-atras-barra-v2": ("a barbell reverse lunge at the deep bottom position, one barbell across the upper traps, front foot flat and front knee near 90 degrees, rear foot stepped long backward on its toes and rear knee hovering above the floor", "side 3/4 view"),
    "curl-muneca-inverso-sentado-barra-v2": ("a seated reverse barbell wrist curl at the raised position, both forearms resting on the thighs with palms down, wrists extending above the knees while one light straight barbell rises only through wrist motion", "front 3/4 view"),
    "press-inclinado-agarre-inverso-barra-v2": ("a reverse-grip incline barbell bench press at the bottom position inside one compact rack, athlete on a 45-degree incline bench, palms facing the face, elbows tucked and one barbell lowered to the upper chest", "front 3/4 view"),
    "curl-muneca-inverso-sentado-barra": ("a seated overhand barbell wrist curl at peak extension, both forearms braced along the thighs, wrists hanging beyond the knees and one light straight barbell lifted by raising the backs of the hands", "side 3/4 view"),
    "elevacion-gemelos-sentado-barra-v2": ("a seated barbell calf raise at peak contraction, athlete upright on one flat bench with one padded barbell balanced across both lower thighs above the knees, forefeet on one low block and both heels raised high", "side 3/4 view"),
    "curl-concentrado-bilateral-barra-sentado": ("a seated bilateral concentration curl with one short straight barbell at peak contraction, athlete leaning slightly forward with legs spread, backs of both upper arms braced against the inner thighs and palms-up close grip bringing the bar toward the shoulders", "front 3/4 view"),
    "sentadilla-lateral-barra": ("a wide-stance barbell lateral squat at the deepest position to one side, one barbell across the upper traps, working knee bent over its foot, opposite leg fully extended, both feet flat and torso upright", "front 3/4 view"),
    "elevacion-pierna-alterna-sentado-barra-v2": ("a seated alternating single-leg raise with one lightweight barbell secured horizontally across the upper thighs just above the knees, athlete upright near the edge of one bench, one leg extended straight forward near horizontal and the opposite foot planted", "front 3/4 view"),
    "sentadilla-dividida-barra-v2": ("a stationary barbell split squat at the bottom position, one barbell across the upper traps, long staggered stance with both feet remaining planted, front thigh nearly horizontal, rear knee hovering above the floor and torso upright", "side 3/4 view"),
    "elevacion-gemelos-de-pie-barra-v2": ("a standing barbell calf raise at peak contraction, one barbell across the upper traps, feet hip-width, both heels lifted high with weight balanced evenly on the forefeet, knees straight and torso vertical", "rear 3/4 view"),
    "curl-biceps-inverso-barra-de-pie": ("a standing reverse-grip barbell curl at peak contraction, athlete upright with one straight barbell held palms down at shoulder width, elbows pinned beside the torso, wrists neutral and bar near the lower chest", "front 3/4 view"),
    "elevacion-gemelos-balanceo-barra": ("a standing rocking barbell calf raise captured at the high-toe phase, one barbell across the upper traps, both heels raised high and body balanced on the forefeet, legs straight and posture stable", "side 3/4 view"),
    "remo-menton-barra-v2": ("a wide-grip standing barbell upright row at peak contraction, hands slightly wider than shoulders on one straight barbell lifted close to the upper chest, elbows high and wide above the hands, torso still", "front 3/4 view"),
    "remo-menton-barra-v3": ("a shoulder-width standing barbell upright row at peak contraction, one straight barbell traveling close to the torso up to chest height, elbows pointing high and outward above the wrists, core braced and body vertical", "rear 3/4 view"),
    "estiramiento-aductores-tumbado-lateral-apoyo": ("an assisted side-lying adductor stretch beside one low flat bench, athlete lying on one side with lower leg slightly bent on the mat and upper leg straight with its heel supported on the bench, pelvis lowering gently below the supported foot", "side 3/4 view"),
    "sit-up-asistido-pies-sujetos": ("an assisted sit-up at the 45-degree midpoint on one mat, knees bent and both feet secured beneath one low padded foot anchor, hands lightly behind the head with elbows open and abdomen curled", "side 3/4 view"),
    "dominada-supina-asistida-maquina-de-pie": ("a standing-platform assisted-machine chin-up at the top position, athlete standing on one moving assistance footplate and holding two overhead handles with a shoulder-width supinated grip, palms toward the face, elbows down and chin above hand height", "front 3/4 view"),
    "dominada-prona-asistida-maquina-de-pie": ("a standing-platform assisted-machine pull-up at the top position, athlete standing on one moving assistance footplate and gripping one overhead bar slightly wider than shoulders with palms forward, elbows down and chin above the bar", "front 3/4 view"),
    "extension-triceps-asistida-toalla-de-pie": ("a standing overhead triceps extension using exactly one towel, athlete upright with both hands gripping the towel behind the head, elbows close beside the ears and forearms extending upward while the towel remains taut", "rear 3/4 view"),
    "fondo-triceps-asistido-maquina-rodillas": ("a kneeling assisted-machine triceps dip near the bottom position, both knees on one moving counterweight pad, torso upright, hands on close parallel dip handles and elbows tucked beside the ribs at about 90 degrees", "side 3/4 view"),
    "fondo-pecho-agarre-amplio-asistido-maquina": ("a kneeling assisted-machine wide-grip chest dip at the bottom position, both knees on one moving counterweight pad, torso leaning forward, hands on widely spaced parallel handles and elbows flared slightly with shoulders near elbow height", "front 3/4 view"),
    "paso-zancada-adelante-atras": ("a bodyweight forward-and-back stepping lunge at the forward lunge position, front knee near 90 degrees over the foot, rear knee hovering above the floor, torso upright and arms in a natural running counter-swing", "side 3/4 view"),
    "estiramiento-espalda-pectoral-brazos-entrelazados": ("a standing upper-back and chest mobility stretch, both arms straight forward at shoulder height with fingers interlaced and palms pushed outward, shoulder blades spread and upper back gently rounded", "rear 3/4 view"),
    "salto-hacia-atras": ("a two-foot backward jump captured in midair, athlete traveling backward with both feet clearly off the floor, knees and hips softly flexed, arms counterbalancing and a clear empty landing area behind", "side view"),
    "jalon-banda-agarre-cerrado-sentado": ("a seated close-grip resistance-band lat pulldown at peak contraction, athlete upright on one bench below one overhead anchor, gripping the two ends of one band close together with palms inward and pulling them to the upper chest, elbows down", "front 3/4 view"),
    "jalon-banda-supino-de-pie": ("a standing underhand resistance-band lat pulldown at peak contraction, athlete facing one overhead anchor with staggered feet, both supinated hands shoulder-width on one band pulled toward the upper chest and elbows driving down", "front 3/4 view"),
    "curl-biceps-alterno-barras-cortas": ("an alternating standing biceps curl using exactly two short fixed-weight straight bars, one bar in each hand, one arm fully curled with bar near the shoulder while the opposite arm hangs straight, both palms forward and elbows pinned beside the torso", "front 3/4 view"),
    "press-banca-barra-estandar": ("a standard flat barbell bench press at the bottom position inside one compact rack, athlete lying on one flat bench with feet planted, both hands slightly wider than shoulders on one barbell lowered to mid-chest and forearms vertical", "side 3/4 view"),
    "pullover-barra-banco-declinado": ("a decline-bench barbell pullover at the stretched position, athlete lying head-down on one decline bench with feet secured, both arms nearly straight holding one barbell in an arc just behind the head", "side view"),
    "elevacion-gemelos-barra-suelo": ("a standing calf raise using one unloaded barbell shaft immobilized horizontally on the floor as a narrow foot support, both forefeet balanced on the shaft with heels raised high, athlete lightly holding one upright post with one hand", "side 3/4 view"),
    "sentadilla-frontal-barra-pecho": ("a barbell front squat at the deep bottom position, one barbell resting across the front shoulders in a clean rack, elbows pointing forward and high, torso upright, hips below knees and heels planted", "front 3/4 view"),
    "sentadilla-completa-barra": ("a full-depth high-bar back squat at the bottom position, one barbell across the upper traps, feet shoulder-width, hips below knee level, knees tracking over toes, heels planted and spine neutral", "front 3/4 view"),
    "sentadilla-completa-barra-vista-trasera": ("a full-depth high-bar back squat at the bottom position viewed from behind, one barbell across the upper traps, hips below knees, both knees tracking outward over the feet, heels planted and back neutral", "rear view"),
    "sentadilla-completa-barra-vista-lateral": ("a full-depth high-bar back squat at the bottom position viewed exactly from the side, one barbell across the upper traps, hips below knees, shins inclined forward, heels planted and spine neutral", "side view"),
    "estiramiento-cuadriceps-cuadrupedia": ("a quadruped quad mobility stretch on one mat, athlete supported on both hands and one knee while the opposite thigh extends back with that knee bent 90 degrees and heel drawn toward the glutes, hips low and square", "front 3/4 view"),
    "circulos-tobillo-sentado": ("a seated ankle-circle mobility exercise, athlete upright on one mat with one leg extended and lifted slightly off the floor, knee held still while the raised foot turns outward in a controlled circular position", "side 3/4 view"),
    "elevacion-rodillas-colgado-cintas-brazos": ("a hanging bent-knee raise at peak contraction using two padded ab arm slings suspended from one pull-up bar, athlete's upper arms and forearms cradled in the straps, knees together and tucked high toward the chest", "front 3/4 view"),
    "elevacion-piernas-rectas-colgado-cintas-brazos": ("a hanging straight-leg raise at the top position using two padded ab arm slings suspended from one pull-up bar, athlete's arms supported in the straps and both straight legs together horizontal in an L-sit", "side 3/4 view"),
    "toque-punta-pie-equilibrio-brazos-abiertos": ("a single-leg balance toe touch at the deepest hinge, athlete standing on one nearly straight leg while the opposite leg extends long behind, opposite hand reaching to the planted foot and free arm open sideways", "front 3/4 view"),
    "sit-up-completo-brazos-sobre-cabeza": ("a full sit-up at the upright top position on one mat, knees bent and feet planted, torso tall while both straight arms remain extended overhead beside the ears", "side 3/4 view"),
    "elevacion-rodillas-colgado-asistida-banda": ("an assisted hanging knee raise at peak contraction on one straight pull-up bar, athlete gripping overhand with knees tucked toward the chest and one broad resistance band looped from the bar beneath both feet to provide upward assistance", "front 3/4 view"),
    "elevacion-rodillas-colgado-descenso-explosivo": ("a hanging knee raise during the forceful controlled downward extension phase on one straight pull-up bar, athlete gripping overhand with hips flexed, knees beginning to straighten downward together and torso braced without swinging", "side 3/4 view"),
    "estiramiento-gemelo-tumbado-correa": ("a supine strap-assisted calf stretch on one mat, athlete lying face up with one leg along the floor and the working leg raised nearly vertical and straight, one strap looped around the forefoot and pulled with both hands to dorsiflex the ankle", "side 3/4 view"),
    "estiramiento-gluteo-tumbado-rodilla-pecho": ("a supine single-knee-to-chest glute stretch on one mat, athlete lying face up with one leg extended along the floor while both hands clasp the opposite shin and draw that knee toward the chest", "slightly elevated side 3/4 view"),
    "estiramiento-piriforme-tumbado-figura-cuatro": ("a supine figure-four piriformis stretch on one mat, one ankle crossed over the opposite thigh while both hands clasp behind the supporting thigh and draw both legs toward the chest", "slightly elevated side 3/4 view"),
    "elevacion-piernas-tumbado-descenso-lateral": ("a supine straight-leg lateral lowering exercise on one mat, both arms extended in a T for support, both legs straight and together lowered diagonally to one side a few inches above the floor while shoulders stay planted", "slightly elevated front 3/4 view"),
    "elevacion-piernas-tumbado-descenso-explosivo": ("a supine straight-leg raise during the controlled downward phase on one mat, both arms pressing beside the torso, both legs straight and together angled about 45 degrees above the floor with lower back braced", "side 3/4 view"),
    "giro-ruso-balon-medicinal": ("a seated Russian twist at peak rotation on one mat, athlete leaning back with knees bent and both feet raised, holding one medicine ball with both hands beside one hip while the chest rotates", "front 3/4 view"),
    "dominada-asistida-maquina-agarre-neutro-cerrado": ("an assisted-machine narrow neutral-grip pull-up at the top position, athlete kneeling on one counterweight support pad and gripping two close parallel handles with palms facing, elbows down and chin above the handles", "front 3/4 view"),
    "curl-isquiotibial-prono-banda": ("a prone single-leg resistance-band hamstring curl at peak contraction on one mat, one band anchored low behind the athlete and looped around one ankle, working knee bent about 90 degrees with heel drawn toward the glutes", "side 3/4 view"),
    "estiramiento-cuadriceps-prono": ("a self-assisted prone quadriceps stretch on one mat, athlete lying face down with one leg straight, opposite knee bent and same-side hand holding that ankle to draw the heel toward the glutes while pelvis stays down", "side 3/4 view"),
    "estiramiento-recto-femoral-prono-correa": ("a prone rectus-femoris stretch using one strap on one mat, athlete lying face down with one knee bent, strap looped around that ankle and pulled over the shoulder with both hands while pelvis stays pressed down", "side 3/4 view"),
    "dominada-prona-asistida-maquina": ("an assisted-machine overhand pull-up at the top position, athlete kneeling on one counterweight support pad, hands slightly wider than shoulders on pronated handles, elbows down and chin clearly above the handles", "front 3/4 view"),
    "estiramiento-pectoral-sentado-fitball": ("a seated chest stretch on one stability ball, athlete upright with feet planted wide, hands clasped behind the lower back, elbows nearly straight and both arms drawn backward while chest lifts and shoulder blades retract", "side 3/4 view"),
    "estiramiento-pecho-fitball": ("a kneeling unilateral chest stretch using one stability ball, athlete on both knees beside the ball, one hand planted on the floor below the shoulder and the opposite straight arm resting across the top of the ball while chest lowers toward the floor", "front 3/4 view"),
    "flexion-toque-pecho": ("a one-arm high-plank chest-tap push-up at the top position, athlete supported by one straight arm under the shoulder and both feet spread wide, free hand touching the center of the chest, body rigid and hips square", "slightly elevated side 3/4 view"),
    "dominada-agarre-paralelo-estrecho": ("a narrow neutral-grip chin-up at the top position, athlete hanging from two close parallel handles on one pull-up bar, palms facing each other, elbows pulled down close to the ribs and chin above the handles", "front 3/4 view"),
    "circulos-rodillas": ("a standing knee-circle mobility exercise, athlete with feet and knees together, knees softly bent, torso inclined slightly forward and both hands resting directly on the kneecaps while knees angle together to one side", "front view"),
    "flexion-reloj": ("a clock push-up in a high plank at an angled position around a central foot pivot, body rigid and diagonal across the frame, feet close together at the pivot while both hands are planted asymmetrically one step sideways as the athlete moves around the imaginary clock", "slightly elevated front 3/4 view"),
    "dominada-supina-agarre-cerrado": ("a close-grip underhand chin-up at the top position on one straight pull-up bar, both palms facing the athlete and hands closer than shoulder width, elbows down beside the ribs and chin clearly above the bar", "front 3/4 view"),
    "flexion-agarre-cerrado": ("a close-grip push-up at the bottom position, athlete in a rigid full plank with both hands close together directly under the center of the chest, elbows tightly tucked beside the ribs and chest hovering above the hands", "slightly elevated side 3/4 view"),
    "flexion-agarre-cerrado-rodillas": ("a close-grip kneeling push-up at the bottom position, athlete supported on both knees and both hands close together under the chest, straight line from head to knees, elbows tightly tucked and chest hovering above the hands", "side 3/4 view"),
    "encogimiento-capullo": ("a bodyweight cocoon tuck crunch at peak contraction on one mat, athlete lying face up with shoulders and pelvis curled off the floor, both knees tightly drawn toward the chest and both arms reaching around the shins", "side 3/4 view"),
    "toque-pie-giro-cangrejo": ("a crab-position cross-body toe touch at peak rotation, athlete supported by one hand and one planted foot with hips lifted, opposite leg extended high and straight while the free hand reaches to touch that raised foot", "slightly elevated front 3/4 view"),
    "crunch-cruzado": ("a cross-body crunch at peak contraction on one mat, athlete lying face up with one knee drawn in, opposite elbow rotating toward that knee, other leg bent with foot planted and both hands lightly behind the head", "slightly elevated front 3/4 view"),
    "crunch-brazos-sobre-cabeza": ("a floor crunch with both arms extended overhead at peak contraction, athlete lying face up with knees bent and feet planted, shoulders lifted, straight arms beside the ears reaching diagonally upward and forward", "side 3/4 view"),
    "crunch-fitball": ("a stability-ball crunch at peak contraction, athlete's lower back supported on one exercise ball, feet planted wide, knees bent 90 degrees, arms crossed over the chest and ribs curled toward the pelvis", "side 3/4 view"),
    "crunch-fitball-brazos-rectos": ("a stability-ball crunch with straight arms at peak contraction, athlete's lower back supported on one exercise ball, feet planted, shoulders lifted and both straight arms reaching vertically upward above the chest", "side 3/4 view"),
    "crunch-suelo": ("a classic floor crunch at peak contraction on one mat, athlete lying face up with knees bent and feet planted, hands lightly behind the head, elbows open and only the shoulders curled off the floor", "side 3/4 view"),
    "curl-up-pierna-extendida": ("a curl-up at peak contraction with one leg straight along the floor and the opposite knee bent with foot planted, athlete lying face up, hands lightly behind the head and shoulders lifted only a short distance", "slightly elevated side 3/4 view"),
    "sentadilla-reverencia": ("a bodyweight curtsy squat at the bottom position, athlete upright with one leg planted forward and the opposite leg stepped diagonally far behind and across it, both knees bent and hands together at chest height", "front 3/4 view"),
    "bicicleta-aire": ("an athlete riding one complete air-resistance fan bike, seated upright with both feet on pedals and both hands gripping the moving vertical handles in an alternating push-pull position, large fan wheel fully visible", "side 3/4 view"),
    "crunch-declinado": ("a decline-bench crunch at peak contraction, athlete lying face up on one sloped decline bench with feet secured under the top rollers, knees bent, hands crossed over the chest and shoulders curled toward the knees", "side 3/4 view"),
    "flexion-profunda-mancuernas": ("a deep deficit push-up at the bottom position using two stable hex dumbbells as handles, athlete gripping one dumbbell in each hand in a rigid plank, chest lowered clearly below hand level between the dumbbells", "slightly elevated side 3/4 view"),
    "giro-torso-de-pie-polea": ("a standing cable torso twist at peak rotation, athlete side-on to one chest-height pulley, both hands clasping one D-handle with arms nearly straight in front of the chest, shoulders rotated away from the machine while hips remain square", "front 3/4 view"),
    "giro-diagonal-alto-bajo-polea": ("a standing high-to-low cable woodchop at peak contraction, athlete side-on to one high pulley, both hands holding one D-handle beside the opposite hip, arms nearly straight, torso rotated diagonally downward and knees softly bent", "front 3/4 view"),
    "tiron-unilateral-con-giro-polea": ("a standing single-arm cable twisting pull at peak contraction, athlete in a wide staggered stance facing one low pulley, torso hinged forward, one D-handle pulled beside the ribs while chest rotates open and free arm reaches slightly forward", "side 3/4 view"),
    "curl-biceps-banco-inclinado-polea": ("a two-arm incline bench cable biceps curl at peak contraction, athlete seated with back fully supported on one incline bench between two low pulleys, one D-handle in each supinated hand near the shoulders, upper arms hanging behind the torso", "side 3/4 view"),
    "patada-triceps-bilateral-polea": ("a standing bilateral low-cable triceps kickback at lockout, athlete facing away from two low pulleys with torso hinged forward, one D-handle in each hand, upper arms pinned beside the ribs and both forearms fully extended straight behind", "rear 3/4 view"),
    "jalon-supino-polea": ("a seated underhand cable lat pulldown at peak contraction, athlete upright facing one high pulley, both hands shoulder-width and supinated on one long lat bar pulled to the upper chest, elbows directed down beside the torso", "rear 3/4 view"),
    "cruces-pectorales-ascendentes-polea": ("a standing dual low-cable upper-chest crossover at peak contraction, athlete centered between two low pulleys in a staggered stance, one D-handle in each hand, nearly straight arms sweeping upward and inward until hands meet in front of the upper chest", "front view"),
    "remo-alto-sentado-barra-recta-polea": ("a seated chest-height cable upper row at peak contraction, athlete upright on one flat bench facing a cable tower, both hands wide and pronated on one straight bar pulled to the upper chest, elbows flared and shoulder blades retracted", "rear 3/4 view"),
    "remo-menton-polea": ("a standing low-cable upright row at peak contraction, athlete holding one short straight bar with a narrow pronated grip, bar raised close to the body to mid-chest height, elbows leading high and outward", "front 3/4 view"),
    "jalon-tras-nuca-agarre-amplio-polea": ("a seated wide-grip behind-the-neck cable lat pulldown at peak contraction, athlete upright facing one high pulley, hands very wide on one curved lat bar lowered behind the head to the upper traps, elbows pointing down", "rear 3/4 view"),
    "curl-muneca-polea": ("a seated low-cable wrist curl at peak flexion, athlete facing one low pulley with both forearms supported across the thighs, palms up on one short straight bar, hands curled upward only at the wrists while elbows stay still", "front 3/4 view"),
    "estiramiento-gemelo-pie-pared": ("a standing calf stretch with the forefoot pressed vertically against one plain wall, working heel firmly on the floor and knee nearly straight, both hands resting on the wall while the other leg stands one step behind", "side view"),
    "estiramiento-gemelo-manos-pared": ("a classic standing calf stretch facing one plain wall, both hands supported at shoulder height, front knee bent and rear leg extended straight with the entire rear heel planted firmly on the floor", "rear 3/4 view"),
    "estiramiento-gemelo-tumbado-cuerda": ("a supine rope-assisted calf stretch on one mat, athlete lying face up with one leg extended along the floor and the working leg raised nearly vertical, one rope looped around the ball of the raised foot and pulled gently with both hands", "side view"),
    "remo-tumbado-boca-abajo-barra-curva": ("a prone chest-supported cambered-bar row at peak contraction, athlete lying face down on one high flat bench with whole torso supported, feet braced behind, both hands pronated on one curved bar pulled toward the lower chest from beneath the bench", "slightly elevated side 3/4 view"),
    "elevacion-piernas-rectas-silla-romana": ("a captain's-chair straight-leg raise at the top position, athlete supported upright by forearms and back pad in one Roman chair station, both legs together and fully straight extended horizontally in front, feet at hip height", "side 3/4 view"),
    "estiramiento-pierna-extendida-silla": ("a seated single-leg extended hamstring stretch on one simple chair, athlete upright at the seat edge, one heel on the floor far in front with knee straight and toes up, opposite foot planted and torso hinging slightly forward", "front 3/4 view"),
    "estiramiento-pecho-hombro-pasada-barra": ("a standing chest and front-shoulder dowel pass-through stretch, athlete holding one light straight dowel with a very wide grip and straight arms behind the head at upper-back height, shoulders externally rotated and torso upright", "front 3/4 view"),
    "fondos-pecho-torre-dominadas": ("a chest-focused bodyweight dip at the bottom position on the parallel handles of one freestanding dip and pull-up tower, athlete suspended with knees bent behind, torso leaning forward, elbows flexed and shoulders just below elbow height", "side 3/4 view"),
    "fondos-pecho-barra-recta": ("a chest-focused straight-bar dip at the bottom position on one single horizontal bar, both hands shoulder-width on the same bar in front of the torso, athlete suspended above it with chest leaning forward over the bar, elbows bent back and legs hanging together", "side 3/4 view"),
    "crunch-de-pie-cuerda-polea": ("a standing high-cable rope crunch at peak contraction, athlete facing away from one cable tower, rope ends held beside the temples, elbows bent and torso curled forward toward the knees while hips stay fixed", "side 3/4 view"),
    "extension-cadera-de-pie-polea": ("a standing single-leg low-cable hip extension at peak contraction, athlete facing away from one low pulley with one ankle strap attached, working leg extended straight behind, torso upright and support leg softly bent", "rear 3/4 view"),
    "curl-interno-de-pie-polea": ("a standing bilateral high-cable inner biceps curl at peak contraction, athlete centered between two cable towers, upper arms abducted horizontally at shoulder height, elbows flexed and D-handles curled inward beside the head with palms up", "front view"),
    "elevacion-diagonal-de-pie-polea": ("a standing low-to-high cable diagonal lift at peak rotation, both straight arms holding one D-handle above the opposite shoulder, torso rotated away from one low pulley while hips remain stable", "front 3/4 view"),
    "extension-triceps-unilateral-de-pie-polea": ("a standing single-arm high-cable triceps extension at lockout, athlete side-on to one high pulley, working elbow pinned beside the ribs, one D-handle pressed down beside the thigh with palm facing back", "front 3/4 view"),
    "elevacion-talon-unilateral-de-pie-polea": ("a standing single-leg calf raise at peak contraction on one small step beside one cable tower, athlete holding the tower frame for balance, free knee bent behind and working heel raised high, no loose handle and no cable attached to the athlete", "rear 3/4 view"),
    "jalon-de-pie-cuerda-polea": ("a standing high-cable rope pulldown at peak contraction, athlete facing one high pulley, upper arms angled forward and upward, elbows flexed wide as both rope ends are pulled toward the forehead, torso upright", "front 3/4 view"),
    "remo-deltoide-posterior-de-pie-cuerda-polea": ("a standing high-cable rope rear-delt row at peak contraction, athlete facing one pulley, rope pulled toward the upper chest and face, elbows flared horizontally and shoulder blades retracted", "rear 3/4 view"),
    "extension-triceps-unilateral-supina-sobre-cabeza-polea": ("a standing single-arm reverse-grip low-cable overhead triceps extension at lockout, athlete facing away from one low pulley, working upper arm vertical beside the head, palm-up D-handle extended overhead and free hand on the hip", "rear 3/4 view"),
    "remo-de-pie-barra-v-polea": ("a standing cable row with one V-bar at peak contraction, athlete facing one chest-height pulley, neutral-grip V-bar pulled to the upper abdomen, elbows close and shoulder blades retracted", "front 3/4 view"),
    "rotacion-externa-hombro-de-pie-polea": ("a standing single-arm cable shoulder external rotation, athlete side-on to one elbow-height pulley, working elbow bent exactly 90 degrees and pinned to the ribs, forearm rotated outward away from the abdomen while upper arm stays still", "front 3/4 view"),
    "remo-con-giro-de-pie-barra-v-polea": ("a standing cable twist row with one V-bar at peak contraction, athlete facing one chest-height pulley, bar pulled toward one side of the ribs while shoulders and torso rotate to that same side, hips stable", "front 3/4 view"),
    "cruces-pectorales-de-pie-polea": ("a standing dual-cable chest crossover at peak contraction, athlete centered upright between two shoulder-height pulleys, arms nearly straight and both D-handles crossed in front of the chest, chest engaged", "front view"),
    "jalon-brazos-rectos-cuerda-polea": ("a standing high-cable straight-arm rope pulldown at peak contraction, athlete facing one high pulley with torso slightly inclined, both arms nearly straight and rope ends separated beside the thighs", "side 3/4 view"),
    "remo-sentado-espalda-recta-polea": ("a straight-back seated low-cable row at peak contraction, athlete seated with feet braced and knees softly bent, two D-handles pulled beside the abdomen, torso upright and shoulder blades retracted", "side 3/4 view"),
    "aperturas-inversas-tumbado-boca-arriba-polea": ("a supine dual-cable reverse fly on one flat bench at peak contraction, athlete lying face up centered between two pulleys, one D-handle in each hand, arms opened wide at shoulder level with softly bent elbows and cables taut", "slightly elevated front 3/4 view"),
    "remo-kayak-thibaudeau-polea": ("a standing Thibaudeau kayak cable row at peak alternating contraction, athlete facing one high pulley and holding both ends of one long rope, one hand pulled down beside the hip while the opposite hand remains extended forward and high, torso slightly rotated", "front 3/4 view"),
    "jalon-triceps-barra-v-polea": ("a standing high-cable triceps pushdown with one V-bar at lockout, athlete facing the cable tower, neutral grip, elbows pinned beside the torso and both arms fully extended with the V-bar beside the thighs", "front 3/4 view"),
    "jalon-triceps-barra-v-arm-blaster-polea": ("a standing high-cable triceps pushdown with one V-bar and one clearly visible rigid arm-blaster brace across the chest, elbows supported by the brace and arms fully extended at lockout", "front 3/4 view"),
    "crunch-inverso-agrupado-polea": ("a supine cable tuck reverse crunch at peak contraction on one mat, head nearest one low pulley, both hands holding one cable handle above the chest, knees tightly drawn toward the chest and pelvis curled off the floor", "slightly elevated side 3/4 view"),
    "curl-biceps-sentado-polea": ("a seated two-arm low-cable biceps curl at peak contraction, athlete on one flat bench facing one low pulley, both hands supinated on one short straight bar between the knees, elbows pinned beside the torso and no preacher pad", "front 3/4 view"),
    "remo-alto-sentado-barra-v-polea": ("a seated high-cable row with one V-bar at peak contraction, athlete upright facing one high pulley, neutral-grip V-bar pulled from overhead to the upper chest, elbows down and back", "rear 3/4 view"),
    "remo-sentado-unilateral-alternado-polea": ("an alternating seated low-cable row at mid-repetition, athlete upright with feet planted, one D-handle pulled beside the ribs while the opposite arm remains fully extended holding a second independent D-handle", "front 3/4 view"),
    "curl-concentrado-sentado-unilateral-polea": ("a seated single-arm low-cable concentration curl at peak contraction, torso inclined forward, working elbow braced against the inner thigh and one supinated D-handle near the shoulder", "front 3/4 view"),
    "curl-sentado-sobre-cabeza-polea": ("a seated bilateral high-cable overhead biceps curl at peak contraction, athlete centered between two high pulleys, upper arms raised horizontally to each side, elbows fixed and both D-handles curled beside the head with palms inward", "front view"),
    "elevacion-lateral-posterior-sentado-polea": ("a seated bent-over dual low-cable rear lateral raise at peak contraction, torso folded over the thighs, crossed D-handles opened wide to shoulder height with softly bent elbows", "rear 3/4 view"),
    "remo-sentado-polea": ("a classic seated low-cable row at peak contraction, feet braced and knees softly bent, one D-handle in each hand pulled beside the abdomen, elbows close and torso upright", "side 3/4 view"),
    "rotacion-interna-hombro-sentado-polea": ("a seated single-arm cable shoulder internal rotation, athlete side-on to one elbow-height pulley, working elbow bent exactly 90 degrees and pinned to the ribs, forearm rotated inward across the abdomen while upper arm stays still", "front 3/4 view"),
    "giro-torso-sentado-polea": ("a seated cable torso twist at peak rotation, athlete side-on on one flat bench with feet planted, both straight arms holding one D-handle together, shoulders rotated away from one chest-height pulley while hips stay square", "slightly elevated front 3/4 view"),
    "remo-sentado-agarre-amplio-polea": ("a seated low-cable wide-grip row at peak contraction, feet braced, both hands pronated wide on one long straight bar pulled to the lower chest, elbows flared and shoulder blades retracted", "rear 3/4 view"),
    "encogimiento-hombros-polea": ("a standing low-cable barbell shrug at peak contraction, both hands pronated on one straight bar in front of the thighs, arms fully straight and shoulders elevated vertically toward the ears", "front 3/4 view"),
    "flexion-lateral-polea": ("a standing single-arm low-cable side bend at peak contraction, athlete side-on to one low pulley, near hand holding one D-handle beside the thigh with arm straight, torso bent laterally and hips level", "front 3/4 view"),
    "crunch-lateral-bosu-polea": ("a seated high-cable oblique crunch on one Bosu half-ball at peak diagonal flexion, feet planted, one D-handle held beside the head and shoulder moving toward the opposite hip while pelvis stays stable", "front 3/4 view"),
    "crunch-lateral-polea": ("a standing single-arm high-cable side crunch at peak contraction, athlete side-on to one high pulley, one D-handle held beside the head with elbow bent, ribs flexed laterally toward the same-side hip and pelvis still", "front 3/4 view"),
    "sentadilla-remo-cuerda-polea": ("a low-cable rope squat row at peak contraction, athlete facing one low pulley in a deep stable squat, both rope ends pulled to the abdomen, elbows back, chest lifted and heels planted", "front 3/4 view"),
    "curl-biceps-sentadilla-polea": ("a low-cable biceps curl held in a deep squat at peak contraction, feet shoulder-width and heels planted, both hands supinated on one short straight bar near the shoulders, elbows close to the torso", "front 3/4 view"),
    "curl-muneca-trasero-polea": ("a standing low-cable behind-the-back wrist curl, athlete facing away from one low pulley, both straight arms behind the thighs holding one short bar with palms backward, wrists flexed upward while elbows stay still", "rear 3/4 view"),
    "elevacion-talones-polea": ("a standing cable calf raise at peak contraction on one low step, athlete facing the cable machine and lightly holding its rail for balance, knees nearly straight, both heels lifted high and feet supported on the forefoot", "rear 3/4 view"),
    "aperturas-inversas-altas-cruzadas-polea": ("a standing crossed high-cable reverse fly at peak contraction, athlete centered between two high pulleys, right hand holding the left D-handle and left hand holding the right D-handle, arms opened wide at shoulder height with cables visibly crossed", "rear 3/4 view"),
    "crunch-de-pie-polea": ("a standing high-cable crunch at peak contraction, athlete facing away from one high pulley, both hands holding one short bar behind the head, knees softly bent and spine flexed forward with hips fixed", "side 3/4 view"),
    "extension-horizontal-unilateral-triceps-polea": ("a standing single-arm horizontal cable triceps extension at lockout, athlete facing away from one shoulder-height pulley, working upper arm raised parallel to the floor, one D-handle punched straight forward by elbow extension and free hand on the hip", "rear 3/4 view"),
    "jalon-tras-nuca-polea": ("a seated behind-the-neck cable lat pulldown at peak contraction, athlete upright facing away from one high pulley, both hands wide on one curved lat bar lowered behind the head to the upper traps, elbows pointing down", "rear 3/4 view"),
    "crunch-inverso-polea": ("a supine low-cable reverse crunch at peak contraction, athlete lying on a mat with feet toward one low pulley, one cable attached securely to both ankles, knees drawn toward the chest and pelvis curled off the floor", "slightly elevated side 3/4 view"),
    "curl-inverso-polea": ("a standing low-cable reverse curl at peak contraction, both hands shoulder-width on one straight bar with palms down, elbows pinned beside the torso and wrists neutral", "front 3/4 view"),
    "jalon-triceps-inverso-barra-z-arm-blaster-polea": ("a standing reverse-grip high-cable triceps pushdown at lockout using one EZ bar and one visible arm-blaster brace across the chest, palms up, elbows supported beside the torso", "front 3/4 view"),
    "curl-inverso-unilateral-polea": ("a standing single-arm low-cable reverse curl at peak contraction, one D-handle held palm-down near the shoulder, working elbow pinned beside the torso and free arm relaxed", "front 3/4 view"),
    "curl-predicador-inverso-polea": ("a seated two-arm low-cable reverse preacher curl at peak contraction, both upper arms supported on one preacher pad, both hands pronated on one short bar and wrists neutral", "front 3/4 view"),
    "curl-muneca-inverso-polea": ("a seated low-cable reverse wrist curl, both forearms supported on the thighs, palms down on one short straight bar and only the wrists extended upward", "front 3/4 view"),
    "remo-alto-sentado-agarre-inverso-polea": ("a seated high-cable row with reverse grip at peak contraction, athlete upright facing one high pulley, both hands supinated on one wide lat bar pulled to the upper chest, elbows down and back", "front 3/4 view"),
    "remo-sentado-cuerda-cruzada-polea": ("a seated low-cable crossover rope row at peak contraction, feet braced, both hands holding crossed rope ends drawn toward opposite sides of the torso, elbows open and shoulder blades retracted", "rear 3/4 view"),
    "remo-sentado-elevado-cuerda-polea": ("an elevated seated low-cable rope row at peak contraction, athlete on one raised bench with feet braced, both rope ends pulled to the upper abdomen and torso upright", "side 3/4 view"),
    "remo-banco-inclinado-cuerda-polea": ("a chest-supported incline-bench low-cable rope row at peak contraction, athlete prone against one 45-degree bench facing one low pulley, rope ends separated beside the chest and shoulder blades retracted", "side 3/4 view"),
    "curl-martillo-predicador-cuerda-polea": ("a standing two-arm low-cable rope hammer preacher curl at peak contraction, both upper arms supported on one preacher pad, one rope held with neutral grip and hands near the shoulders", "front 3/4 view"),
    "extension-triceps-sobre-cabeza-cuerda-polea-alta": ("a standing high-pulley rope overhead triceps extension at lockout, athlete facing away in a staggered stance, upper arms fixed beside the ears and rope ends separated forward above the head", "side 3/4 view"),
    "extension-triceps-inclinada-cuerda-polea": ("an incline-bench cable rope triceps extension at lockout, athlete reclined with head nearest one low pulley behind the bench, upper arms beside the head and both rope ends extended overhead", "side view"),
    "extension-triceps-suelo-cuerda-polea": ("a supine floor low-cable rope triceps extension at lockout, athlete lying with head nearest one low pulley, upper arms vertical and still, both rope ends separated above the chest", "side 3/4 view"),
    "curl-martillo-predicador-unilateral-cuerda-polea": ("a seated single-arm low-cable rope hammer preacher curl at peak contraction, one upper arm supported on one preacher pad, one hand holding exactly one rope end in neutral grip near the shoulder", "front 3/4 view"),
    "remo-sentado-cuerda-polea": ("a classic seated low-cable rope row at peak contraction, feet braced and knees softly bent, both rope ends pulled to the abdomen with elbows close and torso upright", "side 3/4 view"),
    "giro-ruso-fitball-polea": ("a cable Russian twist supported on one stability ball, shoulders and upper back on the ball with hips bridged and feet planted, both straight arms holding one D-handle from a high pulley and torso rotated to one side", "slightly elevated front 3/4 view"),
    "crunch-sentado-polea": ("a seated high-cable rope crunch at peak contraction, athlete seated facing away from one high pulley, rope held beside the head, spine flexed forward toward the knees while hips remain still", "side 3/4 view"),
    "elevacion-lateral-unilateral-polea": ("a standing single-arm cable lateral raise at shoulder height, athlete side-on to one low pulley, outside hand holding one D-handle with a softly bent elbow, torso upright and free arm relaxed", "front 3/4 view"),
    "curl-predicador-unilateral-polea": ("a standing single-arm low-cable preacher curl at peak contraction, upper arm fully supported on one preacher pad, palm-up grip on one D-handle near the shoulder and cable taut", "side 3/4 view"),
    "press-unilateral-fitball-polea": ("a seated single-arm cable chest press on one stability ball at lockout, athlete upright with both feet planted, back to one chest-height pulley, one D-handle pressed straight forward and torso resisting rotation", "front 3/4 view"),
    "jalon-unilateral-polea": ("a standing single-arm high-cable lat pulldown at peak contraction, athlete facing one high pulley, one D-handle pulled beside the ribs with elbow close to the torso and free arm relaxed", "front 3/4 view"),
    "curl-inverso-predicador-unilateral-polea": ("a standing single-arm reverse low-cable preacher curl at peak contraction, upper arm fully supported on one preacher pad, palm-down grip on one D-handle and wrist neutral", "side 3/4 view"),
    "remo-alto-unilateral-arrodillado-polea": ("a kneeling single-arm cable high row at peak contraction, athlete upright on both knees facing one chest-height pulley, one D-handle pulled toward the chest with elbow back and free arm relaxed", "front 3/4 view"),
    "extension-triceps-unilateral-polea": ("a standing single-arm high-cable triceps pushdown at lockout, athlete facing one high pulley, working elbow pinned beside the torso, one D-handle pressed down beside the thigh and free arm relaxed", "front 3/4 view"),
    "curl-biceps-sobre-cabeza-polea": ("a standing high-cable overhead biceps curl at peak contraction, athlete facing one high pulley, both hands supinated on one short straight bar close to the forehead, upper arms raised and elbows fixed", "front 3/4 view"),
    "curl-biceps-sobre-cabeza-fitball-polea": ("a seated high-cable overhead biceps curl on one stability ball at peak contraction, athlete upright with feet planted, both hands supinated on one short straight bar close to the forehead and elbows raised", "front 3/4 view"),
    "remo-rotacion-palmas-polea": ("a standing dual-handle cable row with palm rotation at peak contraction, one handle in each hand pulled beside the lower ribs, palms visibly turned upward, elbows back and shoulder blades retracted", "front 3/4 view"),
    "curl-predicador-polea": ("a seated two-arm low-cable preacher curl at peak contraction, both upper arms fully supported on one preacher pad, palms up on one short straight bar close to the shoulders and cable taut", "front 3/4 view"),
    "press-pecho-fitball-polea": ("a seated dual-cable chest press on one stability ball at lockout, athlete upright with feet planted, back to two chest-height pulleys, one handle in each hand pressed straight forward and core braced", "front view"),
    "jalon-al-pecho-polea": ("a classic seated wide-grip lat pulldown at peak contraction, thighs secured beneath one pad, both hands overhand on one long straight bar pulled to the upper chest, chest lifted and elbows down", "front 3/4 view"),
    "jalon-barra-dorsal-profesional-polea": ("a seated lat pulldown using exactly one professional angled lat bar at peak contraction, thighs secured, hands gripping the downward-angled outer handles, bar near the upper chest and elbows down", "front 3/4 view"),
    "jalon-curl-biceps-polea": ("a standing high-cable pulldown biceps curl at peak contraction, athlete facing one high pulley, both hands supinated on one straight bar drawn toward the upper chest, upper arms angled forward and cable taut", "front 3/4 view"),
    "extension-triceps-barra-polea": ("a standing high-cable straight-bar triceps pushdown at lockout, both hands overhand on one short straight bar beside the thighs, elbows pinned to the torso and cable taut", "front 3/4 view"),
    "jalon-brazos-rectos-polea-v2": ("a standing straight-arm cable pulldown at peak contraction, athlete facing one high pulley in a slight hip hinge, both hands overhand on one straight bar at the thighs, elbows nearly locked and lats engaged", "side 3/4 view"),
    "extension-triceps-cuerda-polea": ("a standing high-cable rope triceps pushdown at lockout, both hands holding exactly one rope, elbows pinned beside the torso and rope ends separated beside the thighs", "front 3/4 view"),
    "remo-deltoide-posterior-agarraderas-polea": ("a bent-over dual-cable rear-delt row at peak contraction, one crossed D-handle in each hand from two low pulleys, elbows flared outward at shoulder height and spine neutral", "rear 3/4 view"),
    "remo-deltoide-posterior-cuerda-polea": ("a bent-over low-cable rear-delt rope row at peak contraction, both hands separating the ends of exactly one rope toward the upper chest, elbows flared high and spine neutral", "front 3/4 view"),
    "extension-triceps-rodillas-polea": ("a kneeling high-cable rope triceps extension at lockout, athlete upright on both knees facing away from one high pulley, one rope held beside the head, upper arms fixed by the ears and both forearms fully extended forward", "side 3/4 view"),
    "jalon-dorsal-recorrido-completo-polea": ("a full-range seated lat pulldown at peak contraction, thighs secured beneath one knee pad, both hands wide on one long bar pulled to the upper chest, elbows down, chest lifted and cable taut from one high pulley", "front 3/4 view"),
    "jalon-lateral-cuerda-polea": ("a standing high-cable lateral pulldown with one rope attachment, both hands separating the rope ends toward the sides of the upper chest, elbows down and back, torso slightly reclined and cable taut", "front 3/4 view"),
    "jalon-lateral-barra-v-polea": ("a seated high-cable lat pulldown with exactly one neutral-grip V-bar pulled to the upper chest, thighs secured under one pad, elbows close to the torso and cable taut", "front 3/4 view"),
    "aperturas-bajas-polea": ("a standing low-to-high dual-cable chest fly at peak contraction, athlete centered between two low pulleys in a staggered stance, one handle in each hand rising in a wide arc until the hands meet before the upper chest", "front 3/4 view"),
    "remo-bajo-sentado-polea": ("a seated low-cable row at peak contraction, feet braced and knees softly bent, both hands holding one straight bar in an overhand grip pulled to the lower abdomen, torso upright and cable taut", "front 3/4 view"),
    "curl-biceps-tumbado-polea": ("a supine cable biceps curl on one flat bench at peak contraction, head away from one low pulley, both palms up on one shoulder-width straight bar curled toward the shoulders, upper arms fixed beside the torso", "side 3/4 view"),
    "curl-tumbado-agarre-cerrado-polea": ("a supine close-grip cable biceps curl on one flat bench at peak contraction, head away from one low pulley, both palms up and hands close together on one short straight bar curled toward the upper chest", "side 3/4 view"),
    "pullover-tumbado-cuerda-polea": ("a supine high-cable rope pullover on one flat bench, head nearest one high pulley, both hands holding one rope with arms almost straight and drawing the rope in an arc from behind the head to above the chest", "side 3/4 view"),
    "aperturas-tumbado-polea": ("a flat-bench dual-cable chest fly at peak contraction, athlete lying securely between two low pulleys, one handle in each hand meeting above the center chest, elbows softly bent and both cables taut", "slightly elevated front 3/4 view"),
    "extension-triceps-tumbado-cuerda-polea": ("a supine low-cable rope triceps extension on one flat bench at lockout, head nearest one low pulley, both hands holding one rope above the chest, upper arms vertical and still, elbows fully extended", "side 3/4 view"),
    "aperturas-medias-polea": ("a standing mid-height dual-cable chest fly at peak contraction, athlete centered between two chest-height pulleys in a staggered stance, one handle in each hand meeting horizontally before the sternum, elbows softly bent", "front view"),
    "remo-unilateral-inclinado-polea": ("a single-arm bent-over low-cable row at peak contraction, athlete facing one low pulley in a stable hip hinge, one handle pulled to the lower ribs with elbow close to the torso, free hand resting on the thigh", "side 3/4 view"),
    "curl-biceps-unilateral-polea": ("a standing single-arm low-cable biceps curl at peak contraction, athlete facing one low pulley, palm up on one handle near the shoulder, working elbow pinned beside the torso and free arm relaxed", "front 3/4 view"),
    "aperturas-declinadas-unilateral-polea": ("a single-arm cable decline chest fly on one decline bench, athlete lying securely beside one low pulley, one handle sweeping in a wide arc to finish above the lower chest, working elbow softly bent and free hand resting on the torso", "slightly elevated side 3/4 view"),
    "aperturas-unilateral-fitball-polea": ("a single-arm cable chest fly supported on one stability ball at peak contraction, shoulders and upper back on the ball, hips bridged and feet planted, one handle drawn above the center chest from one low pulley, free arm extended for balance", "front 3/4 view"),
    "aperturas-inclinadas-unilateral-fitball-polea": ("a single-arm incline cable chest fly supported diagonally on one stability ball at peak contraction, hips raised and feet planted, one handle drawn above the upper chest from one low pulley, working elbow softly bent", "side 3/4 view"),
    "press-inclinado-unilateral-polea": ("a single-arm cable incline bench press at lockout, athlete seated against one 45-degree bench with back supported, one handle pressed upward over the upper chest from one low pulley, free hand resting on the torso", "slightly elevated front 3/4 view"),
    "press-inclinado-unilateral-fitball-polea": ("a single-arm incline cable chest press supported diagonally on one stability ball at lockout, hips raised and feet firmly planted, one handle pressed upward over the upper chest from one low pulley, torso resisting rotation", "front 3/4 view"),
    "elevacion-lateral-inclinada-unilateral-polea": ("a single-arm bent-over low-cable lateral raise at shoulder height, athlete facing one low pulley in a stable hip hinge, working arm extended out to the side with a softly bent elbow, free hand braced on the thigh", "rear 3/4 view"),
    "press-pecho-pie-polea": ("a standing dual-cable chest press at full extension, athlete facing away from two chest-height pulleys, one handle in each hand, both taut cables running behind the arms, staggered stance and torso upright", "front 3/4 view"),
    "curl-biceps-agarre-cerrado-polea": ("a standing close-grip low-cable biceps curl at peak contraction, both palms up on one short straight-bar attachment, hands close together, elbows pinned beside the torso and cable taut", "front 3/4 view"),
    "curl-concentrado-polea": ("a seated single-arm low-cable concentration curl at peak contraction, working elbow firmly braced against the inner thigh, palm up, other hand resting on the opposite thigh and cable visibly taut", "front 3/4 view"),
    "extension-triceps-concentrada-rodilla-polea": ("a seated single-arm low-cable concentration triceps extension, working elbow braced against the inner knee, forearm extended until the arm is straight, torso slightly forward and cable taut", "front 3/4 view"),
    "jalon-cruzado-lateral-polea": ("a standing cross-over lateral cable pulldown at the bottom, athlete centered between two shoulder-height pulleys, arms crossing to take opposite handles and then pulling both handles diagonally down and outward, shoulder blades retracted", "front view"),
    "aperturas-declinadas-polea": ("a standing high-to-low dual-cable chest fly at peak contraction, athlete facing away from two high pulleys, one handle in each hand, arms sweeping down in a wide arc until the hands meet before the lower chest", "front 3/4 view"),
    "press-declinado-unilateral-polea": ("a single-arm cable decline press on one decline bench, athlete lying securely with one handle pressed above the lower chest at lockout, other hand resting on the torso and one taut cable", "slightly elevated side 3/4 view"),
    "press-declinado-polea": ("a dual-cable decline chest press on one decline bench, athlete lying securely between two low pulleys with one handle in each hand pressed above the lower chest at lockout, both cables taut", "slightly elevated front 3/4 view"),
    "remo-sentado-declinado-agarre-amplio-polea": ("a reclined seated wide-grip low-cable row at peak pull, feet braced, torso leaning slightly back with neutral spine, both hands wide on one long straight bar pulled toward the lower chest and cable taut", "front 3/4 view"),
    "curl-arrastre-polea": ("a standing low-cable drag curl at peak contraction, both palms up on one straight-bar attachment, bar sliding close to the torso toward the upper abdomen as both elbows travel behind the body", "side 3/4 view"),
    "elevacion-frontal-polea": ("a standing cable front raise at shoulder height, athlete facing away from one low pulley with the cable passing between the legs, both hands holding one short straight bar, arms almost straight and parallel to the floor", "side 3/4 view"),
    "remo-alto-rodillas-polea": ("a kneeling high cable row at peak pull, athlete upright on both knees facing one high pulley, both hands on one straight bar pulled toward the upper chest, elbows traveling back and cable taut", "front 3/4 view"),
    "aduccion-cadera-polea": ("a standing cable hip adduction at the crossed-leg end position, athlete side-on to one low pulley with an ankle cuff on the near leg, cuffed leg crossing in front of the planted support leg, torso upright and one hand braced on the machine", "front 3/4 view"),
    "press-inclinado-polea": ("a dual-cable incline bench press at lockout, athlete seated against one 45-degree incline bench between two low pulleys, one handle in each hand pressed upward over the upper chest and both cables taut", "slightly elevated front 3/4 view"),
    "remo-banco-inclinado-polea": ("a chest-supported incline bench cable row at peak contraction, athlete prone against one 45-degree bench facing a low pulley, both hands pulling one straight-bar attachment toward the sides of the chest, elbows back and cable taut", "side 3/4 view"),
    "aperturas-inclinadas-polea": ("a dual-cable incline bench fly at peak contraction, athlete lying against one 45-degree incline bench between two low pulleys, one handle in each hand meeting above the upper chest, elbows softly bent and both cables taut", "slightly elevated front 3/4 view"),
    "extension-triceps-inclinada-polea": ("a standing forward-leaning overhead low-cable triceps extension at lockout, athlete facing away from one low pulley, both hands holding one short straight bar overhead, upper arms beside the ears and cable taut behind the body", "side 3/4 view"),
    "giro-judo-polea": ("a standing cable judo flip at the diagonal finish, athlete side-on to one pulley holding a single handle with both hands above the far shoulder, hips and torso rotated together, rear heel pivoted and cable taut across the body", "front 3/4 view"),
    "patada-triceps-polea": ("a single-arm low-cable triceps kickback at lockout, athlete facing the machine in a stable hip hinge, working upper arm pinned beside the torso and forearm fully extended backward with one taut cable", "side 3/4 view"),
    "remo-deltoide-posterior-rodillas-cuerda-polea": ("a kneeling low-cable rear-delt rope row at peak pull, athlete upright on both knees facing one low pulley, pulling both rope ends toward the chest with elbows flared outward, shoulder blades retracted and cable taut", "front 3/4 view"),
    "curl-biceps-agarre-amplio-barra": ("a standing wide-grip barbell biceps curl at peak contraction, palms up, both hands clearly wider than shoulder width, elbows pinned beside the torso and one complete light straight barbell near the upper abdomen", "front 3/4 view"),
    "press-militar-agarre-amplio-barra": ("a standing wide-grip barbell military press at overhead lockout, both hands clearly wider than shoulder width on one complete straight barbell, wrists stacked, torso vertical and core braced", "front 3/4 view"),
    "curl-inverso-agarre-amplio-barra": ("a standing wide-grip reverse barbell curl at mid-contraction, both palms facing down, hands clearly wider than shoulder width, elbows fixed beside the torso and one complete light straight barbell horizontal", "front 3/4 view"),
    "step-up-barra": ("a barbell step-up near the top, one complete straight barbell secured across the upper back, entire lead foot planted on one stable plyometric box, lead hip and knee extending while the trailing foot is lifted", "side 3/4 view"),
    "buenos-dias-piernas-rigidas-barra": ("a stiff-leg barbell good morning near the bottom, one straight barbell secured across the upper back, knees only slightly unlocked, hips pushed far back, torso hinged almost parallel to the floor and spine neutral", "side view"),
    "peso-muerto-piernas-rectas-barra": ("a straight-leg barbell deadlift near the bottom, both legs almost straight, hips pushed back, one complete straight barbell held close below the knees, arms long and spine neutral", "side 3/4 view"),
    "press-banca-agarre-amplio-barra": ("a wide-grip barbell bench press near the controlled bottom on one flat bench, both hands clearly wider than shoulder width, one complete straight barbell centered above the mid chest, feet planted and shoulder blades retracted", "slightly elevated front 3/4 view"),
    "press-banca-agarre-inverso-amplio-barra": ("a wide reverse-grip barbell bench press near the controlled bottom on one flat bench, both palms unmistakably facing the athlete, hands wider than shoulder width, wrists straight and one complete barbell above the lower chest", "slightly elevated front 3/4 view"),
    "remo-menton-agarre-amplio-barra": ("a wide-grip barbell upright row at the top, both hands clearly wider than shoulder width in an overhand grip, one complete light straight barbell near the upper chest and elbows leading outward above the hands", "front 3/4 view"),
    "tocar-puntas-pies-pie": ("a standing toe-touch stretch near the comfortable bottom, feet hip-width, legs almost straight, torso folded forward from the hips and both hands reaching toward the shoe tips without forcing the spine", "side view"),
    "estiramiento-pecho-manos-tras-cabeza": ("a standing behind-head chest stretch, fingers interlaced behind the crown, elbows opened wide, shoulder blades gently retracted and sternum lifted without arching the lower back", "rear 3/4 view"),
    "extension-cadera-banco-peso-corporal": ("a bodyweight bench hip extension at the top in a reverse-table position, both palms braced behind on the edge of one flat bench, feet planted, knees bent and hips lifted until shoulders, hips and knees align", "side view"),
    "giro-tumbado-rodillas-flexionadas": ("a supine bent-knee lying twist near the end range, both arms extended in a T on the floor, shoulders grounded, knees together and bent while both legs lower toward one side", "slightly elevated front 3/4 view"),
    "remo-sentadilla-peso-corporal": ("a bodyweight suspension squat row at peak pull, athlete leaning back from two taut suspension straps while holding a deep squat, both elbows pulled beside the ribs, chest lifted and feet planted", "front 3/4 view"),
    "salto-cajon-estabilizacion-unilateral": ("a single-leg stabilization immediately after a box jump, one foot fully planted on top of one stable plyometric box, support knee softly bent, other leg hovering and arms balancing", "side 3/4 view"),
    "escalador-cruzado": ("a cross-body mountain climber in a high plank, both hands under the shoulders, one knee driving toward the opposite elbow, other leg extended and hips level", "front 3/4 view"),
    "postura-mariposa-yoga": ("a seated butterfly yoga pose, soles of both feet together close to the pelvis, knees opened outward, both hands holding the feet and spine long and upright", "front view"),
    "press-hombro-alterno-polea": ("an alternating dual-cable shoulder press, standing between two low pulleys with one handle pressed overhead at lockout while the other handle remains at shoulder height, torso upright and cables taut", "front 3/4 view"),
    "extension-triceps-alterna-polea": ("a standing alternating single-arm cable triceps extension at lockout, one cable handle in the working hand, upper arm fixed near shoulder height, forearm extended backward and cable visibly taut to one pulley", "side 3/4 view"),
    "peso-muerto-polea": ("a low-cable deadlift near the bottom, both hands holding one straight-bar attachment connected to a clearly visible low pulley, hips back, knees moderately bent, arms long and spine neutral", "side 3/4 view"),
    "extension-triceps-sentado-sobre-cabeza-barra": ("a seated overhead barbell triceps extension at the controlled bottom, torso upright on one flat bench, both upper arms vertical beside the ears, elbows deeply bent and one complete light straight barbell behind the crown", "side 3/4 view"),
    "giro-sentado-barra": ("a seated barbell torso twist at mid-rotation, sitting upright on one flat bench with both feet planted, one light straight barbell secured across the upper back, hips fixed and shoulders visibly rotated", "front 3/4 view"),
    "inclinacion-lateral-barra": ("a standing barbell side bend near the controlled end range, one light straight barbell secured across the upper back, hips level, legs straight and torso tilted laterally without rotation", "front 3/4 view"),
    "sentadilla-apertura-amplia-barra": ("a wide-stance barbell back squat near the bottom, one straight barbell secured across the upper back, feet much wider than shoulders with toes turned slightly outward, knees aligned and chest high", "front 3/4 view"),
    "peso-muerto-una-pierna-barra": ("a single-leg barbell deadlift near the bottom, one complete straight barbell held close below the knees, support leg slightly bent, free leg extended straight behind, hips square and spine neutral", "side view"),
    "sentadilla-dividida-barra": ("a stationary barbell split squat near the bottom, one straight barbell secured across the upper back, staggered feet fixed in place, front thigh near parallel and rear knee hovering above the floor", "side 3/4 view"),
    "elevacion-pierna-alterna-sentado-barra": ("a seated alternating straight-leg raise at peak elevation, torso upright on the edge of one flat bench, one leg extended forward and raised while the other foot remains planted, one very light straight barbell stabilized across the thighs by both hands", "front 3/4 view"),
    "esquiador-barra": ("an explosive light-barbell skier pull at the powerful upward phase, knees and hips extending, one complete straight barbell traveling close to the torso toward the upper chest, elbows high and torso braced", "front 3/4 view"),
    "sentadilla-velocidad-barra": ("a light-barbell speed squat during the fast controlled ascent, one straight barbell secured across the upper back, both feet planted, knees aligned, chest high and hips driving upward without jumping", "side 3/4 view"),
    "sentadilla-rodillas-barra": ("a kneeling barbell squat near the bottom, both knees on one thin exercise mat, one light straight barbell secured across the upper back, hips moving back toward the heels while the torso stays upright", "side 3/4 view"),
    "sentadilla-salto-zancada-atras-barra": ("a light-barbell squat-jump to reverse-lunge combination at the stable reverse-lunge landing, one straight barbell secured across the upper back, front foot planted and rear knee hovering above the floor", "side 3/4 view"),
    "rodillo-abdominal-pie-barra": ("an advanced standing barbell rollout near full extension, both feet planted far behind, both hands gripping one straight barbell with round plates rolling on the floor, arms long and body braced in a straight diagonal line", "side view"),
    "curl-muneca-tras-espalda-barra": ("a standing behind-the-back barbell wrist curl at peak flexion, both arms straight behind the hips, palms facing backward, one light straight barbell raised only by the wrists while the torso remains upright", "rear 3/4 view"),
    "press-bradford-pie-barra": ("a standing Bradford press at the controlled transition, torso braced, one light straight barbell passing just above the crown from front to back, elbows bent and arms deliberately not locked out", "side 3/4 view"),
    "elevacion-gemelos-pie-barra": ("a standing barbell calf raise at peak elevation, one straight barbell secured across the upper back, both legs straight, both heels visibly high and body balanced on the balls of the feet", "side 3/4 view"),
    "curl-biceps-agarre-cerrado-barra": ("a standing close-grip barbell biceps curl at peak contraction, both palms up, hands visibly narrower than shoulder width, elbows pinned beside the torso and one light straight barbell near the upper abdomen", "front 3/4 view"),
    "press-militar-agarre-cerrado-barra": ("a standing close-grip barbell military press at overhead lockout, both hands slightly narrower than shoulder width on one complete straight barbell, wrists stacked, torso vertical and core braced", "front 3/4 view"),
    "curl-concentrado-unilateral-barra": ("an advanced one-arm standing concentration curl at mid-contraction, exactly one hand balancing the center of one very light complete straight barbell, bar horizontal, free hand braced on the thigh and working elbow close to the torso", "front 3/4 view"),
    "elevacion-frontal-sobre-cabeza-barra": ("a standing light-barbell front raise at the overhead finish, both nearly straight arms holding one complete horizontal barbell above the crown, overhand shoulder-width grip, torso still and ribs down", "side 3/4 view"),
    "giro-pie-barra": ("a standing barbell torso twist at mid-rotation, one light straight barbell secured across the upper back, feet and hips facing forward while the shoulders rotate under control", "front 3/4 view"),
    "elevacion-escapular-banco-inclinado-barra": ("an incline barbell serratus shoulder raise at peak protraction, lying face-up on one 45-degree incline bench, both arms straight and vertical above the upper chest while the shoulder blades lift slightly from the pad, one complete light barbell level with equal small plates", "side 3/4 view"),
    "elevacion-cadera-tumbado-banco-barra": ("a barbell lying hip raise at full lockout, shoulders and upper torso lying lengthwise on one flat bench, both feet planted on the floor beyond the bench, knees bent and one padded straight barbell across the hips", "side 3/4 view"),
    "remo-inclinado-unilateral-barra": ("a one-arm bent-over row at peak contraction using one complete light straight barbell held exactly at its center with one hand, bar horizontal below the torso, other arm free, hips hinged and spine neutral", "front 3/4 view"),
    "press-suelo-unilateral-barra": ("a one-arm barbell floor press at lockout, lying supine on the floor with knees bent, exactly one hand balancing the center of one complete light straight barbell horizontally above the chest, free arm resting on the floor", "front 3/4 view"),
    "peso-muerto-lateral-unilateral-barra": ("a one-arm side barbell deadlift near the bottom, one complete light straight barbell on the floor beside the athlete and gripped exactly at its center with the near hand, hips back, knees bent and spine neutral", "front 3/4 view"),
    "sentadilla-unilateral-barra": ("an advanced barbell pistol squat near the bottom, one complete straight barbell secured across the upper back, standing leg deeply bent, other leg extended straight forward without touching the floor, heel planted and torso braced", "side 3/4 view"),
    "curl-muneca-prono-banco-barra": ("a seated palms-down barbell wrist curl at peak extension, both forearms fully supported across one flat bench, wrists beyond the edge, overhand grip on one light straight barbell and hands raised without lifting the forearms", "side 3/4 view"),
    "press-pines-barra": ("a barbell pin press just starting from a dead stop, lying on one flat bench inside one power rack, one complete straight barbell resting visibly on equal safety pins a few centimeters above the chest, hands slightly wider than shoulders", "side 3/4 view"),
    "pullover-barra": ("a straight-arm barbell pullover near the controlled bottom position, lying face-up along one flat bench, both nearly straight arms holding one complete straight barbell behind the crown with equal small plates visible", "slightly elevated side 3/4 view"),
    "pullover-press-barra": ("a barbell pullover-to-press combination at the transition above the chest, lying on one flat bench, one complete light straight barbell centered above the lower chest as the elbows begin to bend after returning from behind the head", "side 3/4 view"),
    "press-banca-agarre-cerrado-inverso-barra": ("a close-grip reverse-grip barbell bench press near the bottom on one flat bench, both palms visibly facing the athlete, hands shoulder-width apart, elbows close to the torso and one complete barbell above the lower chest", "front 3/4 view"),
    "remo-inclinado-agarre-inverso-barra": ("a reverse-grip bent-over barbell row at peak contraction, both palms visibly facing forward in a shoulder-width underhand grip, spine neutral, elbows close and one complete barbell pulled toward the lower abdomen", "front 3/4 view"),
    "press-declinado-agarre-inverso-barra": ("a reverse-grip decline barbell bench press near the bottom, lying on one decline bench with feet secured, both palms visibly facing the athlete, elbows close and one complete barbell above the lower chest", "front 3/4 view"),
    "remo-banco-inclinado-agarre-inverso-barra": ("a chest-supported reverse-grip incline barbell row at peak contraction, lying face-down on one incline bench, both palms visibly forward in an underhand grip, elbows close and bar pulled to the upper abdomen", "front 3/4 view"),
    "extension-triceps-tumbado-agarre-inverso-barra": ("a reverse-grip lying barbell triceps extension at the unmistakable bottom position on one flat bench, both upper arms fixed and vertical, elbows bent about ninety degrees, forearms angled toward the face, one complete light barbell hovering only a few centimeters above the forehead, both palms facing the athlete; not a bench press and the bar is nowhere near the chest", "front 3/4 view"),
    "curl-predicador-agarre-inverso-barra": ("a reverse-grip barbell preacher curl at mid-to-high contraction, seated behind one preacher bench with both upper arms fully supported on its sloped pad, both hands in an unmistakable pronated overhand grip with palms facing the floor and knuckles facing the ceiling, one light straight barbell below shoulder height", "front 3/4 view"),
    "press-militar-tras-nuca-sentado-barra": ("a seated behind-the-neck barbell military press at the unmistakable controlled bottom position viewed from behind, torso upright on one bench, one light straight barbell horizontally behind the crown at ear height with the entire head clearly in front of the bar, wide overhand grip, elbows bent about ninety degrees and forearms vertical", "rear 3/4 view"),
    "press-bradford-sentado-barra": ("a seated Bradford press at the controlled transition, torso upright on one bench, one light straight barbell passing just above the crown from front to back, elbows bent and arms deliberately not locked out", "side 3/4 view"),
    "extension-triceps-tras-nuca-sentado-barra": ("a seated close-grip overhead barbell triceps extension at the controlled bottom, torso upright on one bench, both upper arms vertical beside the ears, elbows deeply bent and one light straight barbell behind the crown", "side 3/4 view"),
    "buenos-dias-sentado-barra": ("a seated barbell good morning near the bottom, sitting wide-legged on one flat bench, one straight barbell secured across the upper back, torso hinged forward from the hips with a perfectly neutral spine", "side 3/4 view"),
    "elevacion-gemelo-unilateral-banda": ("a standing single-leg resistance-band calf raise at peak elevation, only the working forefoot contacting the edge of one low step while pinning the band center, both band ends held at shoulder height, working heel visibly high above the step and free knee bent", "side 3/4 view"),
    "elevacion-tibial-unilateral-banda": ("a standing single-leg resisted dorsiflexion at peak contraction, working heel planted on one low block while the forefoot and toes lift toward the shin, one resistance band looped over the forefoot and stretching to a low anchor in front, free foot raised", "side 3/4 view"),
    "pullover-declinado-brazos-flexionados-barra": ("a bent-arm barbell pullover near the controlled bottom position on one decline bench with the feet secured, both hands gripping one complete straight barbell behind the crown, equal plates visible at both ends and elbows held at a fixed moderate bend", "slightly elevated side 3/4 view"),
    "pullover-declinado-agarre-amplio-barra": ("a wide-grip barbell pullover near the controlled bottom position on one decline bench with the feet secured, both nearly straight arms holding one complete straight barbell behind the crown with equal plates visible at both ends", "slightly elevated side 3/4 view"),
    "sentadilla-zercher-profunda-barra": ("a deep barbell Zercher squat, one straight barbell resting securely in the crooks of both elbows, forearms raised, hips below parallel, knees aligned and torso upright", "front 3/4 view"),
    "hip-thrust-banco-barra": ("a barbell hip thrust at full lockout, upper back supported on the edge of one flat bench, one padded straight barbell across the hips, feet planted and torso level from shoulders to knees", "side 3/4 view"),
    "press-guillotina-barra": ("a controlled wide-elbow barbell bench press near the bottom on one flat bench, both hands using a wide overhand grip, one complete barbell hovering safely above the upper chest below the collarbones, shoulder blades retracted", "slightly elevated front 3/4 view"),
    "sentadilla-barra-alta": ("a high-bar back squat near the bottom, one straight barbell resting high across the trapezius, torso relatively upright, thighs below parallel and knees tracking over the feet", "side 3/4 view"),
    "press-inclinado-agarre-cerrado-barra": ("an incline close-grip barbell bench press near the bottom, lying on one incline bench, hands slightly narrower than shoulder width, elbows close to the ribs and bar above the upper chest", "side 3/4 view"),
    "press-inclinado-agarre-inverso-barra": ("an incline reverse-grip barbell bench press near the bottom, lying on one incline bench, both palms visibly facing the athlete with wrists straight, elbows close and bar above the upper chest", "front 3/4 view"),
    "remo-banco-inclinado-barra": ("a chest-supported incline barbell row at peak contraction, lying face-down on one incline bench, both feet planted, one straight barbell pulled toward the lower chest and elbows behind the torso", "front 3/4 view"),
    "press-jm-barra": ("a barbell JM press at its controlled lowered position on one flat bench, narrow overhand grip, elbows angled forward and bent, one straight barbell positioned between the chin and upper chest", "side 3/4 view"),
    "sentadilla-barra-baja": ("a low-bar back squat near the bottom, one straight barbell resting low across the rear deltoids below the trapezius, hips pushed back, torso naturally inclined and bar balanced over mid-foot", "side 3/4 view"),
    "extension-triceps-detras-cabeza-tumbado-barra": ("a lying barbell triceps extension at the controlled bottom position on one flat bench, both upper arms angled slightly behind vertical and fixed, elbows bent as one complete barbell lowers behind the crown", "side view"),
    "sentadilla-pies-juntos-barra": ("a narrow-stance barbell back squat near the bottom, feet visibly closer than hip width, one straight barbell across the upper back, heels planted, knees aligned and torso braced", "front 3/4 view"),
    "sit-up-press-barra": ("a barbell press sit-up at the top position, torso raised about forty-five degrees from the floor, knees bent and feet planted, both arms holding one light straight barbell at overhead lockout", "side 3/4 view"),
    "curl-biceps-boca-abajo-banco-inclinado-barra": ("a prone incline barbell biceps curl at peak contraction, lying face-down with the chest supported on one incline bench, upper arms hanging vertically and both hands curling one straight barbell toward the shoulders", "front 3/4 view"),
    "rodillo-abdominal-banco-barra": ("a kneeling barbell rollout on a bench near full extension, both knees on the floor behind one flat bench, both hands gripping one straight barbell rolling across the bench surface, arms extended and spine neutral", "side 3/4 view"),
    "remo-deltoides-posteriores-barra": ("a bent-over barbell rear-delt row at peak contraction, spine neutral, wide overhand grip, one straight barbell pulled toward the upper chest with both elbows flared high and outward", "front 3/4 view"),
    "zancada-atras-barra": ("a barbell reverse lunge near the bottom, one straight barbell secured across the upper back, front foot planted, rear foot stepped backward and rear knee hovering above the floor", "side 3/4 view"),
    "sentadilla-remo-banda": ("a resistance-band squat row held near the bottom, facing one waist-height anchor, hips low and chest up while both elbows pull the handles beside the ribs", "front 3/4 view"),
    "crunch-pie-banda": ("a standing resistance-band crunch at peak spinal flexion, back to one high anchor, both hands holding band ends beside the shoulders, sternum curled toward the pelvis while the hips remain stable", "side 3/4 view"),
    "remo-deltoides-posterior-banda": ("a bent-over standing resistance-band rear-delt row at peak contraction, both feet pinning the band center, elbows raised outward at shoulder height, forearms hanging below and spine neutral", "front 3/4 view"),
    "crunch-giratorio-pie-banda": ("a standing twisting resistance-band crunch at peak contraction, band crossed over the upper back and held at the chest, one knee raised while the opposite elbow rotates down toward it", "front 3/4 view"),
    "peso-muerto-piernas-rigidas-espalda-recta-banda": ("a resistance-band stiff-leg deadlift near the bottom, both feet pinning the band center, hands beside the shins, hips pushed far back, knees slightly unlocked and spine perfectly neutral", "side view"),
    "peso-muerto-piernas-rectas-banda": ("a resistance-band straight-leg deadlift near the bottom, both feet pinning the band, legs almost straight, arms long and torso hinged forward with a neutral spine", "side 3/4 view"),
    "press-sobre-cabeza-giratorio-banda": ("a resistance-band twisting overhead press at lockout, both feet pinning the band center, both arms overhead while the shoulders rotate slightly to one side and the hips stay square", "front 3/4 view"),
    "elevacion-gemelos-bilateral-banda": ("a standing bilateral resistance-band calf raise at peak elevation, both feet pinning the band center, band ends held at shoulder height, both heels high and legs straight", "front 3/4 view"),
    "jalon-supino-banda": ("a standing underhand resistance-band pulldown at peak contraction, facing one high anchor, palms toward the athlete, elbows pulled down beside the ribs and handles near the upper chest", "front 3/4 view"),
    "v-up-banda": ("a resistance-band V-up at peak position, torso and both straight legs raised symmetrically, a taut band looped around both feet and held with both hands", "side 3/4 view"),
    "curl-muneca-banda": ("a seated two-hand resistance-band wrist curl at peak flexion, forearms supported on the thighs, palms up and wrists beyond the knees, band center pinned under both feet", "side 3/4 view"),
    "sentadilla-frontal-banco-barra": ("a barbell front box squat just touching one flat bench, bar in the front-rack position across the shoulders, elbows high, hips back and thighs near parallel", "side 3/4 view"),
    "sentadilla-banco-barra": ("a barbell back box squat just touching one flat bench, bar secured across the upper back, hips back, knees aligned over the feet and torso braced", "side 3/4 view"),
    "pullover-brazos-flexionados-barra": ("a bent-arm barbell pullover near the controlled bottom position, supported face-up on one flat bench, both hands gripping one complete straight barbell behind the crown with equal plates visible at both ends, elbows held at a fixed moderate bend", "slightly elevated side 3/4 view"),
    "curl-biceps-arm-blaster-barra": ("a standing barbell biceps curl at peak contraction while wearing one curved metal arm-blaster plate across the front of the torso, upper arms braced on its ends", "front 3/4 view"),
    "sentadilla-frontal-agarre-clean-barra": ("a deep barbell front squat with a clean grip, bar resting across the front deltoids, fingertips under the bar, elbows high, chest upright and thighs below parallel", "front 3/4 view"),
    "press-cerrado-extension-triceps-declinado-barra": ("a decline close-grip barbell skull-press combination at the lowered triceps-extension position, lying on one decline bench with the feet secured, bar close above the forehead, elbows bent and upper arms fixed", "side 3/4 view"),
    "elevacion-frontal-pullover-barra": ("a standing light-barbell front raise and pullover at the overhead transition, arms nearly straight with the bar slightly behind the crown, torso vertical and ribs down", "side 3/4 view"),
    "elevacion-frontal-barra": ("a standing barbell front raise at shoulder height, overhand grip, arms nearly straight, bar horizontal and torso still", "front 3/4 view"),
    "press-declinado-agarre-amplio-barra": ("a decline wide-grip barbell bench press near the bottom, lying on one decline bench with the feet secured, bar above the lower chest, forearms vertical and elbows outward", "front 3/4 view"),
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
