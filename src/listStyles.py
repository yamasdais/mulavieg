from glob import glob 
import os
import re

tailPat = re.compile(r'\.min\.css$')
headPat = re.compile(r'^.(?!ase16/)')
afterSlash = re.compile(r'(?<=/).')
afterHyphen = re.compile(r'-(.)')
with open("../../styleLinks.txt", mode="w") as links, open("../../selList.txt", mode="w") as lists:
    for fname in sorted(glob('**/*.css', recursive=True)):
        name = tailPat.sub("", fname)
        name = headPat.sub(lambda x: x.group(0).upper(), name)
        name = afterSlash.sub(lambda x: x.group(0).upper(), name)
        name = afterHyphen.sub(lambda x: f" {x.group(1).upper()}", name)
        print(f'        <link rel="alternate stylesheet" title="{name}" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/{fname}" disabled="disabled" crossorigin="anonymous"/>',
            end="\n", file=links)
        print(f'                                <li title="{name}">{name}</li>',
            end="\n", file=lists)
