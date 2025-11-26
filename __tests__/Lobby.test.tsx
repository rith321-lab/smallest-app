import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import Lobby from '../app/components/Lobby'

describe('Lobby Component', () => {
    const mockProps = {
        userData: {
            name: 'Test User',
            nationality: 'Testland',
            interests: ['Coding', 'Testing']
        },
        onFindMatch: jest.fn(),
        onCreatePrivate: jest.fn(),
        onJoinPrivate: jest.fn(),
        matchStatus: 'idle' as const,
        onAdmin: jest.fn()
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders user information correctly', () => {
        render(<Lobby {...mockProps} />)
        expect(screen.getByText('Welcome, Test User')).toBeInTheDocument()
        expect(screen.getByText('Testland')).toBeInTheDocument()
        expect(screen.getByText('Coding')).toBeInTheDocument()
        expect(screen.getByText('Testing')).toBeInTheDocument()
    })

    it('calls onFindMatch when Find Match button is clicked', () => {
        render(<Lobby {...mockProps} />)
        const button = screen.getByText('Find Match')
        fireEvent.click(button)
        expect(mockProps.onFindMatch).toHaveBeenCalledTimes(1)
    })

    it('disables Find Match button when searching', () => {
        render(<Lobby {...mockProps} matchStatus="searching" />)
        const button = screen.getByText('Looking for partner...')
        expect(button).toBeDisabled()
    })

    it('calls onCreatePrivate when Create Room button is clicked', () => {
        render(<Lobby {...mockProps} />)
        const button = screen.getByText('Create Room')
        fireEvent.click(button)
        expect(mockProps.onCreatePrivate).toHaveBeenCalledTimes(1)
    })

    it('handles joining a private room', () => {
        render(<Lobby {...mockProps} />)
        const input = screen.getByPlaceholderText('Enter Code')
        const joinButton = screen.getByText('Join')

        // Button should be disabled initially
        expect(joinButton).toBeDisabled()

        // Type code
        fireEvent.change(input, { target: { value: '123456' } })
        expect(joinButton).not.toBeDisabled()

        // Click join
        fireEvent.click(joinButton)
        expect(mockProps.onJoinPrivate).toHaveBeenCalledWith('123456')
    })
})
