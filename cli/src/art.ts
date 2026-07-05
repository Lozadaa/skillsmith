// Pre-rendered ASCII of public/blacksmith.png, inverted to "night-forge chalk"
// so the linework is the lit part on a dark terminal. Generated at width 28 with
// the project's PIL converter (richardlozada.com/scripts/gen-ascii.py, adapted).
export const BLACKSMITH_LINES: string[] = [
  "         :.",
  "         =*-",
  "       .-=::",
  "     .:-:.  -**-",
  "    . =-..:-*==*",
  "   .::=:. +=*+=..",
  "     . -- +:=++. .",
  "       .::    -=::-.",
  "       :#....-: :- :",
  "       +::---=-  :=:.",
  "      ::.     .:.==. .",
  "     .:...====+-.=*##*--",
  "     - :.  .::*#  ##:",
  "    :.:*:...-+#+::---:",
  "   .: --   :%*=.:::::=.",
  "   :===    -#. .     ::",
  "   -:-.    ::         .",
];

/** The blacksmith, each line painted by `paint` (e.g. a dim-bone chalk color). */
export function blacksmith(paint: (s: string) => string): string {
  return BLACKSMITH_LINES.map((l) => paint(l)).join("\n");
}
