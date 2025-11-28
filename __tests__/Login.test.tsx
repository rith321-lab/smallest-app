import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import Login from '../app/components/Login'

describe('Login Component', () => {
    const mockOnJoin = jest.fn()
    const mockOnAdmin = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders all form fields', () => {
        render(<Login onJoin={mockOnJoin} onAdmin={mockOnAdmin} />)

        expect(screen.getByLabelText('Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Nationality')).toBeInTheDocument()
        expect(screen.getByLabelText('Age')).toBeInTheDocument()
        expect(screen.getByLabelText('Gender')).toBeInTheDocument()
        expect(screen.getByText('Interests')).toBeInTheDocument()
        expect(screen.getByText('Enter Platform')).toBeInTheDocument()
    })

    it('allows selecting interests', () => {
        render(<Login onJoin={mockOnJoin} onAdmin={mockOnAdmin} />)

        const travelInterest = screen.getByText('Travel')

        // Select
        fireEvent.click(travelInterest)
        expect(travelInterest).toHaveClass('bg-blue-500')

        // Deselect
        fireEvent.click(travelInterest)
        expect(travelInterest).not.toHaveClass('bg-blue-500')
    })

    it('validates age input', () => {
        render(<Login onJoin={mockOnJoin} onAdmin={mockOnAdmin} />)

        const nameInput = screen.getByLabelText('Name')
        const ageInput = screen.getByLabelText('Age')
        const submitButton = screen.getByText('Enter Platform')

        fireEvent.change(nameInput, { target: { value: 'Test User' } })

        // Invalid age (too young)
        fireEvent.change(ageInput, { target: { value: '10' } })
        fireEvent.click(submitButton)
        expect(mockOnJoin).not.toHaveBeenCalled()

        // Valid age
        fireEvent.change(ageInput, { target: { value: '25' } })
        fireEvent.click(submitButton)
        expect(mockOnJoin).toHaveBeenCalled()
    })

    it('submits form with correct data', () => {
        render(<Login onJoin={mockOnJoin} onAdmin={mockOnAdmin} />)

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test User' } })
        fireEvent.change(screen.getByLabelText('Nationality'), { target: { value: 'Spain' } })
        fireEvent.change(screen.getByLabelText('Age'), { target: { value: '30' } })
        fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Female' } })

        fireEvent.click(screen.getByText('Technology'))
        fireEvent.click(screen.getByText('Enter Platform'))

        expect(mockOnJoin).toHaveBeenCalledWith({
            name: 'Test User',
            nationality: 'Spain',
            age: 30,
            gender: 'Female',
            interests: ['Technology']
        })
    })

    it('calls onAdmin when admin link is clicked', () => {
        render(<Login onJoin={mockOnJoin} onAdmin={mockOnAdmin} />)

        fireEvent.click(screen.getByText('View Dataset Tracker'))
        expect(mockOnAdmin).toHaveBeenCalled()
    })
})
