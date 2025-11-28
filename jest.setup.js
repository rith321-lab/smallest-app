import '@testing-library/jest-dom'

global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
    createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
    createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
    setLocalDescription: jest.fn().mockResolvedValue(),
    setRemoteDescription: jest.fn().mockResolvedValue(),
    addIceCandidate: jest.fn().mockResolvedValue(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    ontrack: null,
    onicecandidate: null,
    onconnectionstatechange: null,
}));


if (typeof window !== 'undefined') {
    Object.defineProperty(global.window.HTMLMediaElement.prototype, 'play', {
        configurable: true,
        get() {
            return () => Promise.resolve();
        },
    });

    Object.defineProperty(global.window.HTMLMediaElement.prototype, 'pause', {
        configurable: true,
        get() {
            return () => { };
        },
    });
}
