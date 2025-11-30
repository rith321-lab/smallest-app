'use client';

import { useState } from 'react';

const NATIONALITIES = [
    'Argentina', 'Bolivia', 'Chile', 'Colombia', 'Costa Rica', 'Cuba',
    'Dominican Republic', 'Ecuador', 'El Salvador', 'Equatorial Guinea',
    'Guatemala', 'Honduras', 'Mexico', 'Nicaragua', 'Panama', 'Paraguay',
    'Peru', 'Spain', 'Uruguay', 'Venezuela', 'Other'
];

const DIALECTS: Record<string, string[]> = {
    'Argentina': ['Rioplatense', 'Cordobés', 'Cuyo', 'Patagonian'],
    'Bolivia': ['Andean', 'Camba', 'Chapaco'],
    'Chile': ['Chilean Spanish', 'Chilote'],
    'Colombia': ['Bogotano', 'Costeño', 'Paisa', 'Caleño', 'Santandereano'],
    'Costa Rica': ['Costa Rican Spanish'],
    'Cuba': ['Cuban Spanish'],
    'Dominican Republic': ['Dominican Spanish'],
    'Ecuador': ['Coastal Ecuadorian', 'Andean Ecuadorian', 'Amazonian'],
    'El Salvador': ['Salvadoran Spanish'],
    'Equatorial Guinea': ['Equatoguinean Spanish'],
    'Guatemala': ['Guatemalan Spanish'],
    'Honduras': ['Honduran Spanish'],
    'Mexico': ['Northern Mexican', 'Central Mexican', 'Southern Mexican', 'Yucatecan'],
    'Nicaragua': ['Nicaraguan Spanish'],
    'Panama': ['Panamanian Spanish'],
    'Paraguay': ['Paraguayan Spanish'],
    'Peru': ['Coastal Peruvian', 'Andean Peruvian', 'Amazonian Peruvian'],
    'Spain': ['Castilian', 'Andalusian', 'Canarian', 'Catalan Spanish'],
    'Uruguay': ['Uruguayan Spanish'],
    'Venezuela': ['Central Venezuelan', 'Maracucho', 'Andean Venezuelan', 'Llanero'],
    'Other': ['Other']
};

const RECORDING_DEVICES = [
    'iPhone',
    'Android Phone',
    'MacBook',
    'Windows Laptop',
    'iPad/Tablet',
    'Desktop Computer',
    'Other'
];

const INTERESTS = [
    'Travel', 'Politics', 'Media', 'Sports', 'Technology', 'Art', 'Music', 'Food', 'History', 'Science',
    'Shopping', 'Self Care', 'Gym', 'Dating', 'Gaming', 'Movies', 'Fashion', 'Nature'
];

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

interface LoginProps {
    onJoin: (data: { name: string; nationality: string; interests: string[]; age: number; gender: string; dialect: string; recordingDevice: string }) => void;
    onAdmin: () => void;
}

export default function Login({ onJoin, onAdmin }: LoginProps) {
    const [name, setName] = useState('');
    const [nationality, setNationality] = useState(NATIONALITIES[0]);
    const [dialect, setDialect] = useState(DIALECTS[NATIONALITIES[0]][0]);
    const [recordingDevice, setRecordingDevice] = useState(RECORDING_DEVICES[0]);
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [age, setAge] = useState(25);
    const [gender, setGender] = useState(GENDERS[0]);

    const handleNationalityChange = (newNationality: string) => {
        setNationality(newNationality);
        setDialect(DIALECTS[newNationality]?.[0] || 'Other');
    };

    const toggleInterest = (interest: string) => {
        setSelectedInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && age >= 18 && age <= 100) {
            onJoin({ name, nationality, interests: selectedInterests, age, gender, dialect, recordingDevice });
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
            <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
                <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                    Spanish Annotator Platform
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="Enter your name"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="nationality" className="block text-sm font-medium text-slate-300 mb-1">Nationality</label>
                        <select
                            id="nationality"
                            value={nationality}
                            onChange={(e) => handleNationalityChange(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
                        >
                            {NATIONALITIES.map(nat => (
                                <option key={nat} value={nat} className="bg-slate-800">{nat}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="dialect" className="block text-sm font-medium text-slate-300 mb-1">Dialect/Region</label>
                        <select
                            id="dialect"
                            value={dialect}
                            onChange={(e) => setDialect(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
                        >
                            {(DIALECTS[nationality] || ['Other']).map(d => (
                                <option key={d} value={d} className="bg-slate-800">{d}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="age" className="block text-sm font-medium text-slate-300 mb-1">Age</label>
                        <input
                            id="age"
                            type="number"
                            value={age}
                            onChange={(e) => setAge(parseInt(e.target.value) || 18)}
                            min="18"
                            max="100"
                            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="gender" className="block text-sm font-medium text-slate-300 mb-1">Gender</label>
                        <select
                            id="gender"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
                        >
                            {GENDERS.map(g => (
                                <option key={g} value={g} className="bg-slate-800">{g}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="recordingDevice" className="block text-sm font-medium text-slate-300 mb-1">Recording Device</label>
                        <select
                            id="recordingDevice"
                            value={recordingDevice}
                            onChange={(e) => setRecordingDevice(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
                        >
                            {RECORDING_DEVICES.map(device => (
                                <option key={device} value={device} className="bg-slate-800">{device}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Interests</label>
                        <div className="flex flex-wrap gap-2">
                            {INTERESTS.map(interest => (
                                <button
                                    key={interest}
                                    type="button"
                                    onClick={() => toggleInterest(interest)}
                                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${selectedInterests.includes(interest)
                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    {interest}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 transform transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Enter Platform
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={onAdmin}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Recordings Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
