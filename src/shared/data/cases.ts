import { Case } from '../types';

export const cases: Case[] = [
    {
        id: "case-001",
        title: "The Midnight Sonata",
        backstory: "Concert pianist Julian Vane was found unconscious in his locked studio. The only sounds from the room were the dissonant chords of his unfinished masterpiece, echoing into the night.",
        solution: "The blackmailer used a modified tuning fork (TF-88) to emit a lethal frequency that triggered a hidden tranquilizer mechanism in the piano. The 200 BPM tempo on the sheet music was the activation signal.",
        evidenceClueIds: ["clue-4", "clue-5"],
        clues: [
            {
                id: "clue-1",
                title: "Burned Sheet Music",
                type: "text",
                content: "A partially burned sheet music page marked with tempo '200 BPM'."
            },
            {
                id: "clue-2",
                title: "Metronome",
                type: "text",
                content: "A metronome ticking incessantly, seized at exactly 200 BPM."
            },
            {
                id: "clue-3",
                title: "Shattered Glass",
                type: "image",
                content: "A shattered crystal glass near the piano bench."
            },
            {
                id: "clue-4",
                title: "Blackmail Note",
                type: "text",
                content: "A note slipped under the door: 'Your talent is stolen, Julian. Pay up by midnight.'"
            },
            {
                id: "clue-5",
                title: "Tuning Fork",
                type: "text",
                content: "A tuning fork #TF-88 vibrating with a lethal, high-pitched frequency."
            }
        ]
    },
    {
        id: "case-002",
        title: "The Whispering Gallery",
        backstory: "An anonymous tip led to the art museum at midnight. A prized painting is missing from the 'whispering gallery', known for its bizarre acoustics.",
        solution: "The thief aimed the laser pointer (LP-900) at a mirror in the West Wing, creating a moving light that the guard mistook for footsteps. The gallery's acoustics made the sound appear to come from the opposite direction.",
        evidenceClueIds: ["clue-3", "clue-4"],
        clues: [
            {
                id: "clue-1",
                title: "Cut Velvet Rope",
                type: "text",
                content: "A velvet rope from the East Wing cut precisely at 11:58 PM."
            },
            {
                id: "clue-2",
                title: "Security Log",
                type: "text",
                content: "A security guard's log: '11:59 PM - Heard footsteps from the East Wing, but the echo came from the West Wing.'"
            },
            {
                id: "clue-3",
                title: "Wall Mirror",
                type: "image",
                content: "A small, perfectly round mirror attached to the West Wing wall."
            },
            {
                id: "clue-4",
                title: "Laser Pointer",
                type: "text",
                content: "A discarded laser pointer, model #LP-900, with a depleted battery."
            },
            {
                id: "clue-5",
                title: "Museum Blueprint",
                type: "text",
                content: "A museum blueprint with the West Wing acoustics marked 'Optimal Distraction Point'."
            }
        ]
    },
    {
        id: "case-003",
        title: "The Clockwork Alibi",
        backstory: "A clockmaker is robbed exactly at noon. His apprentice claims he was across town fixing the grand clock at the exact time of the crime.",
        solution: "The apprentice used a remote servo motor to delay the town clock's chime by three minutes, creating a fake alibi while he robbed the safe using his gear-puller.",
        evidenceClueIds: ["clue-1", "clue-3"],
        clues: [
            {
                id: "clue-1",
                title: "Missing Tool",
                type: "text",
                content: "The apprentice's toolkit, missing a specialized gear-puller #GP-4."
            },
            {
                id: "clue-2",
                title: "Clock Chime",
                type: "text",
                content: "The town square clock chimed noon exactly at 12:03 PM today."
            },
            {
                id: "clue-3",
                title: "Servo Receipt",
                type: "image",
                content: "A receipt for a remote-controlled servo motor #SM-2, dated yesterday."
            },
            {
                id: "clue-4",
                title: "Opened Safe",
                type: "text",
                content: "The clockmaker's safe, opened without forced entry using a GP-4 tool."
            },
            {
                id: "clue-5",
                title: "Pendulum Weight",
                type: "text",
                content: "A heavy pendulum weight found slightly askew in the shop."
            }
        ]
    }
];
