def get_passage_sys_prompt(n):
    number_text = f"a set of {n} MCAT questions"
    if n == 1:
        number_text = "a single MCAT question"

    pre=f"""You're tasked with generating {number_text}. The user will provide you with content from their MCAT study guide. Take your time to formulate an answer, quality is massively more important than speed.

Instructions:
1. Carefully read and analyze the provided study guide content.
2. Generate a relevant passage (if applicable) and a set of questions based on the content.
3. Ensure questions cover various cognitive levels (recall, application, analysis).
4. Create plausible distractors for multiple-choice options.
5. Verify that questions are clear, unambiguous, and scientifically accurate.
6. Ensure that there is only one correct answer per question.

Remember, quality is most important. Take your time to formulate your response."""

    schema="""The return schema should be JSON.
One key `passage` points to the string passage, the other key `questions` should point to a list of JSON objects.
Each object should have a `text` key for question text, `responses` key for multiple choice options,
`answer` for the letter (A, B, C, D) of the correct answer.

Example format:
{
    "passage": "Passage text",
    "questions": [
        \{
            "text": "Question text",
            "responses": [
                "Option A",
                "Option B",
                "Option C",
                “Option D”
            ],
            "answer": "A"
        \},
        ...
    ]
} 
Respond only in JSON.""" + f"Recall that your questions list should have exactly {n} question(s)."

    examples = """Here are two examples of passages with three questions and answers each (not in JSON for clarity, though you should respond in JSON):

Passage 1

Hydrated oxides of carbon and phosphorous are major components of blood serum and serve as buffering agents to this aqueous medium. Molecules with the general formula AOm(OH)n, where A is the central atom, m is either zero or a positive integer, and n is a positive integer, are either oxyacids or bases. For example, the formula for sulfuric acid can be written as SO2(OH)2 (A = S, m = 2, n = 2), while the formula for calcium hydroxide is Ca(OH)2 (A = Ca, m = 0, n = 2). It can be theorized that if the central atom, A, is an alkali or alkaline earth metal, the compound is basic. But if A is a nonmetal, the compound is acidic.
Because of the relationship between the central atom and the acid-base properties of AOm(OH)n compounds, the electronegativity of A can be used to predict which chemical bonds in these compounds will break. When the electronegativity of A is relatively small so that the electronegativity difference between A and O atoms is relatively large, the A-O bond breaks and the OH- ion is released. However, when the electronegativity of A is relatively large, the O-H bond becomes polarized and breaks, releasing the H+ ion.
A researcher attempted to identify an unknown AOm(OH)n compound. The compound completely dissolved in water and weakly conducted electricity. The hydrogen ion concentration of the unknown aqueous solution was 1 x 10^5 M.

Questions

What was the pH of the unknown aqueous solution?
A. 4
B. 5
C. 9
D. 10
Solution: B (pH of a 1*10^-5 hydronium ion concentration is 5. -log([H3O+]))

The unknown compound was probably a
A. Weak base
B. Strong base
C. Weak acid
D. Strong acid
Solution: C

Two additional compounds were studied: NO₂(OH) dissolved in water and produced an acidic solution, and Ni(OH)₂ dissolved only in an acidic solution. What type of compounds were these?
A. Both were oxyacids.
B. Both were bases.
C. NO₂(OH) was a base and Ni(OH)₂ was an oxyacid
D. NO₂(OH) was an oxyacid and Ni(OH)₂ was a base.
Solution: D (The first substance is nitric acid, HNO₃. Since this substance dissolves to generate an acidic solution, the bond between O and H in the structural formula NO₂OH breaks when the substance dissolves, making it an oxyacid. The latter substance, Ni(OH)₂, is apparently insoluble in neutral water, but will dissolve if the solution is acidic. This behavior is typical of substances that feature basic anions. The bond between Ni and O is the one that breaks when Ni(OH)₂ dissolves. The hydroxide ion that is produced quickly reacts with protons in solution and cannot react again with Ni²⁺ to form a precipitate.)

Passage 2
   
Proper biomolecular trafficking, including protein packaging by the Golgi apparatus, is essential to the compartmentalized eukaryotic cell. Therapeutic agents that disrupt the function of the Golgi apparatus reduce cell viability and can serve as effective treatments for carcinoma. ADP-ribosylation factor I (Arf1) plays an essential role in vesicle formation and is responsible for the recruitment of cytosolic coat protein complexes (COPs) and subsequent retrograde transport from the Golgi apparatus. Arf1 is activated by guanine nucleotide exchange factors (GEFs), which replace guanosine diphosphate (GDP) with guanosine triphosphate (GTP). Upon GTP exchange, Arf1 undergoes a conformational change that releases the myristoylated N-terminus of the polypeptide chain from a structural groove in the protein and initiates localization to phospholipid bilayers. Once associated with a bilayer, Arf1 further facilitates vesicle formation by the recruitment of the hetero-tetrameric (dimer of dimers) coatomer protein complex βδ/γζ-COP1 (subunits are represented by β, δ, γ, and ζ). The Arf1 GTPase activating protein (GAP) catalyzes the conversion of Arf1-bound GTP to GDP and inorganic phosphate, thereby converting the protein to the inactive form. GAP activity is increased by Arf1 binding to βδ/γζ-COP1. Brefeldin A (BFA), a lactone compound isolated from fungi, has been shown to inhibit Arf1-driven vesicle formation, resulting in reversible disruption of the Golgi apparatus and tumor remission in vitro. Because of its low bioavailability, BFA is not a suitable candidate for pharmaceutical deployment; however, it has led to the identification of AMF-26 as a promising drug candidate.
AMF-26 is predicted to bind to a protein-protein contact interface of Arf1, preventing GTP exchange by GEF and disrupting Arf1 membrane localization in the initial critical step of COP1 recruitment and vesicle formation. In clinical settings, oral administration of AMF-26 has led to remission of breast cancer xenografts in mice model systems.

Hydrolysis of the γ phosphate of GTP bound to Arf1 results in:
A. Denaturation
B. Activation
C. Inactivation
D. Membrane Association
Solution: C (The passage notes that GAP catalyzes the conversion of Arf1-bound GTP to GDP and inorganic phosphate, thereby converting Arf1 to the inactive form. Therefore hydrolysis of the phosphate of GTP bound to Arf1 results in its inactivation)

The Arf1-activating molecule GTP is most closely related to which family of biomolecules?
A. Nucleotides
B. Amino Acids
C. Lipids
D. Carbohydrates
Solution: A (GTP stands for guanosine tri-phosphate, which is a nucleotide)

GAP belongs to what class of enzymes?
A. Transferase
B. Phosphatase
C. Kinase
D. Isomerase
Solution: B (The passage notes that GAP catalyzes the conversion of GTP to GDP and inorganic phosphate, inferring that it is a phosphatase. Phosphatases are responsible for the cleavage of phosphate bonds utilizing water to remove a molecule of inorganic phosphate)"""
    
    conclusion = "Like the examples, be BRIEF with your passages and include only the relevant information. Use targeted vocabulary."

    return "\n".join([pre, examples, schema, conclusion])

def get_passage_prompt(n, chunks):
    number_text = f"a set of exactly {n} MCAT questions"
    if n == 1:
        number_text = "a single MCAT question"

    pre = f"""Now write {number_text}.
The test taker does not have access to these excerpts, so you should not refer back to the document.\n"""
    excerpts = "\n\n".join([f"*HIDDEN EXCERPT {i+1} from {x.source_name}*\n{x.txt}\n*END OF EXCERPT*" for i, x in enumerate(chunks)])
    post = f"\nNow use the correct JSON format to produce a passage and {number_text}"
    return pre + excerpts + post