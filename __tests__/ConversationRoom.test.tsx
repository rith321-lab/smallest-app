import '@testing-library/jest-dom'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ConversationRoom from '../app/components/ConversationRoom'

// Mock Socket.io
const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    id: 'socket_1'
};

// Mock Media APIs
const mockStream = {
    getTracks: jest.fn(() => []),
    getAudioTracks: jest.fn(() => [{ enabled: true, stop: jest.fn() }])
};

Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream)
    }
});

global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
    addTrack: jest.fn(),
    createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'sdp' }),
    setLocalDescription: jest.fn(),
    setRemoteDescription: jest.fn(),
    close: jest.fn(),
    ontrack: null,
    onicecandidate: null
})) as any;

(global.RTCPeerConnection as any).generateCertificate = jest.fn().mockResolvedValue({});

global.RTCSessionDescription = jest.fn();
global.RTCIceCandidate = jest.fn();

global.MediaRecorder = jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    state: 'inactive',
    ondataavailable: null,
    onstop: null
})) as any;

// Static property for isTypeSupported
(global.MediaRecorder as any).isTypeSupported = jest.fn().mockReturnValue(true);

describe('ConversationRoom Component', () => {
    const mockProps = {
        socket: mockSocket as any,
        roomId: 'room_1',
        userData: { name: 'User 1', nationality: 'Testland' },
        partnerData: { name: 'User 2', nationality: 'Otherland' },
        onEnd: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders user and partner info', async () => {
        await act(async () => {
            render(<ConversationRoom {...mockProps} />);
        });

        expect(screen.getByText('User 1')).toBeInTheDocument();
        expect(screen.getByText('Testland')).toBeInTheDocument();
        expect(screen.getByText('User 2')).toBeInTheDocument();
        expect(screen.getByText('Otherland')).toBeInTheDocument();
    });

    it('handles conversation start event', async () => {
        await act(async () => {
            render(<ConversationRoom {...mockProps} />);
        });

        // Simulate conversation_start
        const startCallback = mockSocket.on.mock.calls.find(call => call[0] === 'conversation_start')[1];

        await act(async () => {
            startCallback({ firstSpeaker: 'socket_1', startTime: Date.now() });
        });

        expect(screen.getByText('Your Turn')).toBeInTheDocument();
        expect(screen.getByText('Speaking...')).toBeInTheDocument();
    });

    it('handles turn switch', async () => {
        await act(async () => {
            render(<ConversationRoom {...mockProps} />);
        });

        // Start conversation first
        const startCallback = mockSocket.on.mock.calls.find(call => call[0] === 'conversation_start')[1];
        await act(async () => {
            startCallback({ firstSpeaker: 'socket_1', startTime: Date.now() });
        });

        // Switch turn
        const switchCallback = mockSocket.on.mock.calls.find(call => call[0] === 'switch_turn')[1];
        await act(async () => {
            switchCallback({ nextSpeaker: 'socket_2', turnNumber: 2, totalTurns: 20 });
        });

        expect(screen.getByText('Listening')).toBeInTheDocument();
        expect(screen.getByText('Listening...')).toBeInTheDocument();
        expect(screen.getByText('Turn 2/20')).toBeInTheDocument();
    });

    it('updates timer', async () => {
        await act(async () => {
            render(<ConversationRoom {...mockProps} />);
        });

        // Start conversation
        const startCallback = mockSocket.on.mock.calls.find(call => call[0] === 'conversation_start')[1];
        await act(async () => {
            startCallback({ firstSpeaker: 'socket_1', startTime: Date.now() });
        });

        // Advance time
        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        expect(screen.getByText('00:29')).toBeInTheDocument();
    });

    it('handles end conversation button', async () => {
        await act(async () => {
            render(<ConversationRoom {...mockProps} />);
        });

        const endButton = screen.getByText('End Conversation');
        fireEvent.click(endButton);

        expect(mockSocket.emit).toHaveBeenCalledWith('end_conversation', 'room_1');
    });
});
