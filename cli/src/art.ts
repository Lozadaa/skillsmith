// Pre-rendered ASCII of a frame from public/blacksmith-frames.png, inverted to
// "night-forge chalk" so the linework is the lit part on a dark terminal.
// Regenerate with:  python cli/scripts/gen-ascii.py --width 44
export const BLACKSMITH_LINES: string[] = [
  "                    :*#%#+.",
  "                   .@@@@@@@-",
  "            ..::--+++**.=#@@:",
  "          :--.. @+::#  = --.",
  "         --     -+:@@*++*-:.",
  "        .#    . =%:=#@@@# .=:",
  "        =-    *=##:.==-#++. --.",
  "        +..::-#+..     #*+.::=+-",
  "       .*..-:.+=      *%-:#*- .=",
  "       .%*#-   ..::.:*%-@#-==. :=",
  "       -##@%*++=:   =##-:@# -=  =",
  "       ## .-+==+%+:++%-::+#:.=+-:=",
  "      #+=    .. ..---== .    =%*=.",
  "     ** --         .:..:     +#:",
  "     +  .=     ..   ...++++++-===-::-:::::-:",
  "    +-  .=     :###+==-:+%-:..-#@@@@@@@%+=+:",
  "   :-    +       :=*#%##%*-    -@@@@#=:",
  "   *    =*             +#@@-    *%@+",
  "  =*  .=%# .... ...::==#%#*.      -=--:",
  " -:  :+**-::::...:@%%@@@#-:-=+++**+-=##==",
  " +.   :*          *@@=**-:::--:-::::+.::#",
  ".+-.:-+-          -@%--   .            :*",
  "+==+**-           -@+=               :  #.",
];

/** The blacksmith, each line painted by `paint` (e.g. a dim-bone chalk color). */
export function blacksmith(paint: (s: string) => string): string {
  return BLACKSMITH_LINES.map((l) => paint(l)).join("\n");
}
