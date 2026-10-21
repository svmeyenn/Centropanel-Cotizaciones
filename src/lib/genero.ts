// Genero de una persona por su primer nombre, para que los mensajes concuerden
// ("Estimada", "interesada", "atenta"). Es una ayuda: lo que se fija a mano en la
// ficha del lead manda sobre esta lista. Un nombre que no esta en la lista y es
// ambiguo (Alexis, Jean, Ariel...) queda sin definir, y el mensaje usa la forma
// neutra "Estimado/a" en vez de adivinar.

export type Genero = "F" | "M";

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const FEMENINOS = new Set(
  (
    "maria ana carolina camila catalina constanza daniela fernanda francisca javiera valentina paula andrea claudia " +
    "patricia carmen rosa luz sofia isabel gabriela monica paola natalia marcela marcia lorena veronica alejandra " +
    "cecilia cristina karen karla karina macarena macarena pamela pilar rocio sandra silvia soledad tamara teresa " +
    "ximena yessica jessica jenny jennifer ingrid irene gloria graciela guadalupe elena elisa eliana elizabeth " +
    "erika erica estefania estefany evelyn fabiola florencia francesca geraldine giselle gisela graciela grace " +
    "helena herminia ines jacqueline johanna josefa josefina juana judith julia juliana karol katherine katherin " +
    "laura leticia lidia liliana lilian lisette loreto lucia luisa magdalena manuela margarita mariana mariela " +
    "marisol marlene marta martha melissa mercedes michelle mirta miriam nancy nelly nicole noelia nora olga " +
    "olivia pia priscila rebeca regina renata rita romina rosario ruth sabrina salome sara sonia stephanie " +
    "susana tatiana tania trinidad ursula vanessa vania victoria viviana wendy yasna yolanda yanet yasmin " +
    "yuliana zulema amanda amelia anais antonella antonia aracely beatriz belen berta blanca bianca brenda " +
    "bernardita cinthia cintia clara clarisa consuelo dayana debora denisse diana dominique dora edith " +
    "emilia emma esperanza esther eugenia eva fabiana felipa flor francia gladys greta haydee ivonne ivette " +
    "jimena joana jocelyn karolina lourdes lucila lupe maite mabel margot maribel marjorie marilyn maura " +
    "milagros mireya nadia natalie nayareth nicolasa nidia noemi norma orietta oriana paloma penelope rafaela " +
    "raquel rosalia rossana roxana ruby samanta scarlett shirley sheila silvana sonya talia thais tiare " +
    "valeria valery vera violeta virginia vivian yazmin yenny zoila alexa alicia alba aida adriana agustina " +
    "alison alondra angela angelica angelina anita antonieta arlette ariadna astrid aurora barbara belinda " +
    "bettina bruna camilla carla carlota cassandra celeste celia cesia chantal charlotte cielo coral cynthia " +
    "dafne dania dayanna delia diamela dolores doris edelmira eloisa elsa elvira emelina ema enriqueta ernestina " +
    "fatima felicia fiorella flavia fresia genoveva georgina geraldina giovanna gricel guillermina hilda ilse " +
    "iris isidora ivana jazmin jeanette jeannette josselyn joyce juanita kimberly lara lea leonor lina livia " +
    "lola lorena luciana lucero lyn mafalda malena marcia margarita mariel marilu marion marisa maya melania " +
    "micaela mia mirella monserrat nahir naomi nathalie nerea nilda ninoska nuria odette ofelia paulina perla " +
    "petronila priscilla rayen reyna rosana rosita sabina samara selena serena silvana soraya stefania tabita " +
    "tamar tomasa trinidad uma valentine vilma wilma xiomara yamila yara yenifer yessenia zoe " +
    "mariapaz mariajose"
  )
    .split(/\s+/)
    .filter(Boolean),
);

const MASCULINOS = new Set(
  (
    "juan jose luis carlos jorge pedro miguel manuel francisco antonio fernando rodrigo sergio ricardo roberto " +
    "eduardo pablo diego cristian christian cristobal claudio mauricio marcelo marco marcos mario martin matias " +
    "nicolas patricio rafael ramon raul rene victor hugo hernan gonzalo guillermo gustavo gabriel felipe " +
    "ignacio ivan javier jaime jesus joaquin julio leonardo lucas mateo mauro maximiliano nelson omar oscar " +
    "osvaldo rolando ronald samuel santiago sebastian simon tomas vicente wilson alejandro alberto alfredo " +
    "alvaro andres angel armando arturo benjamin bruno camilo cesar daniel dario david dante edgardo edgar " +
    "elias emilio enrique ernesto esteban eugenio fabian felix fidel franco gaston german gerardo gianfranco " +
    "giovanni giorgio guido harold hector horacio humberto ismael israel jeremias joel jonathan " +
    "jordan kevin leandro leopoldo lorenzo luciano marcial mariano maximo moises nestor nicanor norberto " +
    "orlando orlando osiel pascual rigoberto rodolfo ruben salvador saul segundo silvio stephan stefan steven " +
    "teodoro thiago tiago tobias ulises valentino walter wladimir yerko yeray yuri zacarias abel abraham adan " +
    "adolfo adrian agustin aldo alexander alexandro alonso amaro anibal aaron augusto aurelio " +
    "baltazar bastian belisario bernardo bernabe boris braulio brayan bryan byron carlo celso ciro clemente " +
    "cleto cornelio cristofer damian dagoberto demetrio dennis denis diogo dionisio donato dylan eder edwin " +
    "efrain eladio eleazar eliseo emanuel erick erik ever evaristo ezequiel fabrizio faustino federico " +
    "florencio fortunato fredy freddy gaspar genaro gerson gilberto giancarlo gianluca gino hans heriberto " +
    "hilario ian ibar ignacio isaac isaias ivo jacinto jairo jhon john jonas josue juvenal kenneth klaus kurt " +
    "lautaro lazaro leo leon liam lisandro lucio luka marlon matthew maurice maximo michael nahuel nathan neil " +
    "nilton noah noel octavio olegario orestes pancho paulo plinio quintin rai ramiro raymundo reinaldo " +
    "renato renzo reynaldo richard robinson rogelio roger romeo romulo ronny ross rufino sandro sixto " +
    "tadeo teofilo thomas timoteo toribio tulio ubaldo valerio vladimir wally william xavier yamil yonatan " +
    "josemaria juanpablo juancarlos luisfelipe"
  )
    .split(/\s+/)
    .filter(Boolean),
);

// Nombres que terminan en a u o y no siguen la regla de la terminacion.
const EXCEPCIONES_A = new Set(["luca", "joshua", "borja", "garcia"]);

// El genero por el primer nombre: la lista primero y, si no esta, la terminacion (a / o). Un nombre
// compuesto se juzga por el primero: "Maria Jose" es mujer y "Jose Maria", hombre.
export function inferirGenero(nombre: string | null | undefined): Genero | null {
  let s = (nombre ?? "").trim();
  if (!s) return null;
  const coma = s.indexOf(",");
  if (coma > 0) s = s.slice(coma + 1).trim();
  const partes = sinTildes(s).split(/[\s-]+/).filter(Boolean);
  const primero = partes[0];
  if (!primero) return null;
  if (FEMENINOS.has(primero)) return "F";
  if (MASCULINOS.has(primero)) return "M";
  if (primero.length >= 4) {
    if (primero.endsWith("a") && !EXCEPCIONES_A.has(primero)) return "F";
    if (primero.endsWith("o")) return "M";
  }
  return null;
}

// Las formas que usan las plantillas. Sin genero definido, se usa la doble forma.
export type Tratos = {
  estimado: string;
  o: string;
  el: string;
  sr: string;
  atento: string;
};

export function tratos(g: Genero | null): Tratos {
  if (g === "F") return { estimado: "Estimada", o: "a", el: "la", sr: "Sra.", atento: "atenta" };
  if (g === "M") return { estimado: "Estimado", o: "o", el: "el", sr: "Sr.", atento: "atento" };
  return { estimado: "Estimado/a", o: "o/a", el: "el/la", sr: "Sr./Sra.", atento: "atento/a" };
}
