import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip,
  FormControl, Select, MenuItem, Switch, CircularProgress,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useListUsersQuery, usePatchUserMutation } from '@/store/api';
import { AppShell } from '@/components/common/AppShell';

export function Users() {
  const { data: users = [], isLoading } = useListUsersQuery();
  const [patchUser, { isLoading: patching }] = usePatchUserMutation();
  const { enqueueSnackbar } = useSnackbar();

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      await patchUser({ id: userId, role }).unwrap();
      enqueueSnackbar('Role updated', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to update role', { variant: 'error' });
    }
  };

  const handleStatusChange = async (userId: number, is_active: boolean) => {
    try {
      await patchUser({ id: userId, is_active }).unwrap();
      enqueueSnackbar(is_active ? 'User activated' : 'User deactivated', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to update status', { variant: 'error' });
    }
  };

  return (
    <AppShell>
      <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>User Management</Typography>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell>ID</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>SSO</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.display_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small">
                        <Select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={patching}
                          sx={{ fontSize: '0.875rem', height: 32 }}
                        >
                          <MenuItem value="user">User</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Switch
                        size="small"
                        checked={user.is_active}
                        onChange={(e) => handleStatusChange(user.id, e.target.checked)}
                        disabled={patching}
                        color="success"
                      />
                    </TableCell>
                    <TableCell>
                      {user.google_id ? (
                        <Chip label="Google" size="small" color="primary" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">Password</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </AppShell>
  );
}
