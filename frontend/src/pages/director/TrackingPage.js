import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { userApi, locationApi } from '@/lib/api';
import { toast } from 'sonner';
import { MapPin, Navigation, Users } from 'lucide-react';

export default function TrackingPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userApi.getUsers();
      setUsers(response.data);
      if (response.data.length > 0) {
        setSelectedUser(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      fetchLocations(selectedUser);
    }
  }, [selectedUser]);

  const fetchLocations = async (userId) => {
    try {
      const response = await locationApi.getUserLocations(userId);
      setLocations(response.data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      toast.error('Failed to load location history');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedUserData = users.find((u) => u.id === selectedUser);

  return (
    <div className="space-y-6" data-testid="tracking-page">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Location Tracking</h1>
        <p className="text-muted-foreground mt-1">Monitor team locations in real-time</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-64">
          <label className="text-sm font-medium mb-2 block">Select User</label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger data-testid="user-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedUserData && (
        <Card className="border-l-4 border-l-accent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <Users size={24} className="text-accent" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-lg">{selectedUserData.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedUserData.email}</p>
                <p className="text-xs text-accent mt-1 uppercase font-semibold">
                  {selectedUserData.role.replace('_', ' ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
            <Navigation size={20} className="text-accent" />
            Location History
          </h3>

          {locations.length === 0 ? (
            <div className="text-center py-12">
              <MapPin size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No location data available for this user</p>
            </div>
          ) : (
            <div className="space-y-3">
              {locations.map((location) => (
                <div key={location.id} className="p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={16} className="text-accent" />
                        <span className="font-mono text-sm">
                          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(location.timestamp).toLocaleString()}
                      </p>
                      {location.accuracy && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Accuracy: ±{Math.round(location.accuracy)}m
                        </p>
                      )}
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors"
                      data-testid="view-on-map-link"
                    >
                      View on Map
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}